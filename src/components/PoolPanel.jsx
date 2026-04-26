import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { CONTRACTS, CURRENT_NETWORK } from '../utils/constants';
import { classifyError, ContractError, truncateAddress } from '../utils/errors';
import * as StellarSdk from '@stellar/stellar-sdk';

export default function PoolPanel() {
  const { publicKey, isConnected, signTransaction } = useWallet();
  const [activeTab, setActiveTab] = useState('swap');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Swap state
  const [swapDirection, setSwapDirection] = useState(true); // true = buy SVT with XLM
  const [swapAmount, setSwapAmount] = useState('');

  // Deposit state
  const [depositAmountA, setDepositAmountA] = useState('');
  const [depositAmountB, setDepositAmountB] = useState('');

  // Pool stats (simulated for demo since contract may not be deployed)
  const poolStats = {
    reserveXLM: '50,000',
    reserveSVT: '500,000',
    totalLiquidity: '$125K',
    fee: '0.3%',
    price: '10 SVT/XLM',
  };

  const contractId = CONTRACTS.POOL.id;

  const invokePoolContract = async (functionName, args) => {
    setStatus('building');
    setResult(null);
    setError(null);

    try {
      if (!contractId) {
        throw new ContractError(
          'Pool contract not yet deployed. See README for deployment instructions.',
          '',
          functionName
        );
      }

      const server = new StellarSdk.rpc.Server(CURRENT_NETWORK.sorobanRpcUrl);
      const sourceAccount = await server.getAccount(publicKey);

      const contract = new StellarSdk.Contract(contractId);
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: CURRENT_NETWORK.networkPassphrase,
      })
        .addOperation(contract.call(functionName, ...args))
        .setTimeout(30)
        .build();

      setStatus('simulating');
      const simResult = await server.simulateTransaction(transaction);

      if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
        throw new ContractError(`Simulation failed: ${simResult.error}`, contractId, functionName);
      }

      const preparedTx = StellarSdk.rpc.assembleTransaction(transaction, simResult).build();

      setStatus('signing');
      const signedXdr = await signTransaction(preparedTx.toXDR());

      setStatus('submitting');
      const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, CURRENT_NETWORK.networkPassphrase);
      const sendResult = await server.sendTransaction(signedTx);

      if (sendResult.status === 'PENDING') {
        let getResult = await server.getTransaction(sendResult.hash);
        while (getResult.status === 'NOT_FOUND') {
          await new Promise((r) => setTimeout(r, 1000));
          getResult = await server.getTransaction(sendResult.hash);
        }
        if (getResult.status === 'SUCCESS') {
          setResult({ type: 'success', hash: sendResult.hash, message: `${functionName} executed!` });
          setStatus('success');
          return;
        }
        throw new ContractError(`Transaction failed: ${getResult.status}`, contractId, functionName);
      }

      setResult({ type: 'success', hash: sendResult.hash, message: `${functionName} executed!` });
      setStatus('success');
    } catch (err) {
      setError(classifyError(err));
      setStatus('error');
    }
  };

  const handleSwap = async (e) => {
    e.preventDefault();
    await invokePoolContract('swap', [
      new StellarSdk.Address(publicKey).toScVal(),
      StellarSdk.nativeToScVal(swapDirection, { type: 'bool' }),
      StellarSdk.nativeToScVal(parseInt(swapAmount) * 10000000, { type: 'i128' }),
      StellarSdk.nativeToScVal(parseInt(swapAmount) * 10000000 * 2, { type: 'i128' }),
    ]);
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    await invokePoolContract('deposit', [
      new StellarSdk.Address(publicKey).toScVal(),
      StellarSdk.nativeToScVal(parseInt(depositAmountA) * 10000000, { type: 'i128' }),
      StellarSdk.nativeToScVal(parseInt(depositAmountB) * 10000000, { type: 'i128' }),
    ]);
  };

  const resetForm = () => {
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span>🌊</span> Liquidity Pool</div>
        </div>
        <div className="text-center text-secondary" style={{ padding: '2rem 0' }}>
          Connect wallet to access the liquidity pool
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🌊</span> {CONTRACTS.POOL.name || 'Liquidity Pool'}
        </div>
        {(status === 'success' || status === 'error') && (
          <button className="btn btn-secondary btn-sm" onClick={resetForm}>Reset</button>
        )}
      </div>

      {!contractId && (
        <div className="tx-status mb-4" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}>
          <div className="tx-status-icon" style={{ background: 'var(--warning)', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚠</div>
          <div className="tx-status-content">
            <div className="tx-status-title" style={{ fontWeight: 600, fontSize: '0.875rem' }}>Contract Not Deployed</div>
            <div className="tx-status-message">Pool contract needs deployment. UI is in demo mode.</div>
          </div>
        </div>
      )}

      {/* Pool Stats */}
      <div className="pool-stats">
        <div className="pool-stat">
          <div className="pool-stat-value">{poolStats.reserveXLM}</div>
          <div className="pool-stat-label">XLM Reserve</div>
        </div>
        <div className="pool-stat">
          <div className="pool-stat-value">{poolStats.reserveSVT}</div>
          <div className="pool-stat-label">SVT Reserve</div>
        </div>
        <div className="pool-stat">
          <div className="pool-stat-value">{poolStats.fee}</div>
          <div className="pool-stat-label">Swap Fee</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="app-nav mb-4">
        <button
          className={`nav-btn ${activeTab === 'swap' ? 'active' : ''}`}
          onClick={() => { setActiveTab('swap'); resetForm(); }}
        >
          🔄 Swap
        </button>
        <button
          className={`nav-btn ${activeTab === 'deposit' ? 'active' : ''}`}
          onClick={() => { setActiveTab('deposit'); resetForm(); }}
        >
          💧 Deposit
        </button>
      </div>

      {/* Swap Tab */}
      {activeTab === 'swap' && status !== 'success' && (
        <form onSubmit={handleSwap}>
          <div className="swap-container">
            <div className="swap-input-box">
              <div className="swap-input-header">
                <span className="swap-input-label">You Pay</span>
                <span className="swap-input-balance">Balance: --</span>
              </div>
              <div className="swap-input-row">
                <input
                  className="swap-amount-input"
                  type="number"
                  placeholder="0.0"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  disabled={status !== 'idle'}
                />
                <div className="swap-token-select">
                  {swapDirection ? '⭐ XLM' : '🪙 SVT'}
                </div>
              </div>
            </div>

            <div className="swap-arrow">
              <button
                type="button"
                className="swap-arrow-btn"
                onClick={() => setSwapDirection(!swapDirection)}
                title="Switch direction"
              >
                ↕
              </button>
            </div>

            <div className="swap-input-box">
              <div className="swap-input-header">
                <span className="swap-input-label">You Receive (est.)</span>
              </div>
              <div className="swap-input-row">
                <input
                  className="swap-amount-input"
                  type="text"
                  placeholder="0.0"
                  value={swapAmount ? (parseFloat(swapAmount) * (swapDirection ? 10 : 0.1)).toFixed(2) : ''}
                  readOnly
                />
                <div className="swap-token-select">
                  {swapDirection ? '🪙 SVT' : '⭐ XLM'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 text-xs text-tertiary text-center">
            Rate: 1 XLM ≈ 10 SVT · Slippage: 0.5%
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full mt-4"
            disabled={status !== 'idle' || !swapAmount}
          >
            {status === 'idle' ? '🔄 Swap' : `⟳ ${status}...`}
          </button>
        </form>
      )}

      {/* Deposit Tab */}
      {activeTab === 'deposit' && status !== 'success' && (
        <form onSubmit={handleDeposit}>
          <div className="form-group">
            <label className="form-label">XLM Amount</label>
            <input
              className="form-input"
              type="number"
              placeholder="100"
              value={depositAmountA}
              onChange={(e) => setDepositAmountA(e.target.value)}
              disabled={status !== 'idle'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">SVT Amount</label>
            <input
              className="form-input"
              type="number"
              placeholder="1000"
              value={depositAmountB}
              onChange={(e) => setDepositAmountB(e.target.value)}
              disabled={status !== 'idle'}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={status !== 'idle' || !depositAmountA || !depositAmountB}
          >
            {status === 'idle' ? '💧 Add Liquidity' : `⟳ ${status}...`}
          </button>
        </form>
      )}

      {/* Result */}
      {result && (
        <div className="tx-status tx-status-success mt-4">
          <div className="tx-status-icon">✓</div>
          <div className="tx-status-content">
            <div className="tx-status-title">{result.message}</div>
            {result.hash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${result.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-hash-link"
              >
                Tx: {truncateAddress(result.hash, 8, 8)}
              </a>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="tx-status tx-status-error mt-4">
          <div className="tx-status-icon">{error.icon || '✗'}</div>
          <div className="tx-status-content">
            <div className="tx-status-title">{error.name}</div>
            <div className="tx-status-message">{error.userMessage || error.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}
