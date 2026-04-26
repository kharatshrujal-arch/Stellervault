import { useState, useEffect, useCallback, useRef } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CURRENT_NETWORK } from '../utils/constants';
import { classifyError, NetworkError, InsufficientFundsError } from '../utils/errors';

const horizonServer = new StellarSdk.Horizon.Server(CURRENT_NETWORK.horizonUrl);

/**
 * Hook: Fetch and poll XLM balance
 */
export function useBalance(publicKey) {
  const [balance, setBalance] = useState(null);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      setBalances([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const account = await horizonServer.loadAccount(publicKey);
      const allBalances = account.balances.map((b) => ({
        type: b.asset_type,
        code: b.asset_type === 'native' ? 'XLM' : b.asset_code,
        balance: b.balance,
        issuer: b.asset_issuer || null,
      }));

      const xlm = allBalances.find((b) => b.type === 'native');
      setBalance(xlm ? xlm.balance : '0');
      setBalances(allBalances);
    } catch (err) {
      // Account not found = 0 balance (unfunded)
      if (err?.response?.status === 404) {
        setBalance('0');
        setBalances([{ type: 'native', code: 'XLM', balance: '0', issuer: null }]);
        setError(null);
      } else {
        setError(classifyError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Initial fetch and polling
  useEffect(() => {
    fetchBalance();
    intervalRef.current = setInterval(fetchBalance, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchBalance]);

  return { balance, balances, loading, error, refetch: fetchBalance };
}

/**
 * Hook: Send XLM transaction
 */
export function useTransaction(publicKey, signTransaction) {
  const [status, setStatus] = useState('idle'); // idle | building | signing | submitting | success | error
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const sendPayment = useCallback(
    async (destination, amount, memo = '') => {
      if (!publicKey) throw new Error('No wallet connected');

      setStatus('building');
      setTxHash(null);
      setError(null);

      try {
        // Load source account
        let sourceAccount;
        try {
          sourceAccount = await horizonServer.loadAccount(publicKey);
        } catch (loadErr) {
          if (loadErr?.response?.status === 404) {
            throw new InsufficientFundsError(
              'Account not found on testnet. Fund it with Friendbot first.',
              parseFloat(amount),
              0
            );
          }
          throw new NetworkError('Failed to load account from Horizon', loadErr);
        }

        // Check balance
        const xlmBalance = sourceAccount.balances.find((b) => b.asset_type === 'native');
        const available = parseFloat(xlmBalance?.balance || '0');
        const required = parseFloat(amount) + 0.00001; // base fee
        if (available < required) {
          throw new InsufficientFundsError(
            `Insufficient XLM. Need ${required}, have ${available}`,
            required,
            available
          );
        }

        // Build transaction
        const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: CURRENT_NETWORK.networkPassphrase,
        })
          .addOperation(
            StellarSdk.Operation.payment({
              destination,
              asset: StellarSdk.Asset.native(),
              amount: String(amount),
            })
          )
          .setTimeout(30);

        if (memo) {
          builder.addMemo(StellarSdk.Memo.text(memo));
        }

        const transaction = builder.build();

        // Sign
        setStatus('signing');
        let signedXdr;
        try {
          signedXdr = await signTransaction(transaction.toXDR());
        } catch (signErr) {
          throw new Error('Transaction signing was cancelled or failed: ' + (signErr.message || ''));
        }

        // Submit
        setStatus('submitting');
        const signedTx = StellarSdk.TransactionBuilder.fromXDR(
          signedXdr,
          CURRENT_NETWORK.networkPassphrase
        );
        const result = await horizonServer.submitTransaction(signedTx);
        
        setTxHash(result.hash);
        setStatus('success');
        return result;
      } catch (err) {
        const classified = classifyError(err);
        setError(classified);
        setStatus('error');
        throw classified;
      }
    },
    [publicKey, signTransaction]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  return { sendPayment, status, txHash, error, reset };
}

/**
 * Hook: Stream account events
 */
export function useEventStream(publicKey) {
  const [events, setEvents] = useState([]);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!publicKey) {
      setEvents([]);
      return;
    }

    try {
      const close = horizonServer
        .payments()
        .forAccount(publicKey)
        .cursor('now')
        .stream({
          onmessage: (payment) => {
            const event = {
              id: payment.id,
              type: payment.type,
              from: payment.from,
              to: payment.to,
              amount: payment.amount,
              asset: payment.asset_type === 'native' ? 'XLM' : payment.asset_code,
              createdAt: payment.created_at || new Date().toISOString(),
              isIncoming: payment.to === publicKey,
              txHash: payment.transaction_hash,
            };
            setEvents((prev) => [event, ...prev].slice(0, 50));
          },
          onerror: (err) => {
            console.warn('Event stream error:', err);
          },
        });

      closeRef.current = close;
    } catch (err) {
      console.warn('Failed to start event stream:', err);
    }

    return () => {
      if (closeRef.current) {
        closeRef.current();
      }
    };
  }, [publicKey]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, clearEvents };
}

/**
 * Fund account via Friendbot (testnet only)
 */
export async function fundWithFriendbot(publicKey) {
  try {
    const response = await fetch(
      `${CURRENT_NETWORK.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Friendbot failed: ${text}`);
    }
    return await response.json();
  } catch (err) {
    throw classifyError(err);
  }
}
