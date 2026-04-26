import { useState, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { useTransaction } from '../hooks/useStellar';
import { isValidPublicKey, isValidAmount, getExplorerUrl, truncateAddress } from '../utils/errors';

export default function SendTransaction() {
  const { publicKey, isConnected, signTransaction } = useWallet();
  const { sendPayment, status, txHash, error, reset } = useTransaction(publicKey, signTransaction);

  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  const validate = useCallback(() => {
    const errors = {};
    if (!isValidPublicKey(destination)) {
      errors.destination = 'Invalid Stellar public key (must start with G, 56 chars)';
    }
    if (destination === publicKey) {
      errors.destination = 'Cannot send to yourself';
    }
    if (!isValidAmount(amount)) {
      errors.amount = 'Enter a valid amount greater than 0';
    }
    if (memo && memo.length > 28) {
      errors.memo = 'Memo must be 28 characters or less';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [destination, amount, memo, publicKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await sendPayment(destination, amount, memo);
    } catch {
      // Error is captured in the hook state
    }
  };

  const handleReset = () => {
    reset();
    setDestination('');
    setAmount('');
    setMemo('');
    setValidationErrors({});
  };

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span>📤</span> Send XLM</div>
        </div>
        <div className="text-center text-secondary" style={{ padding: '2rem 0' }}>
          Connect wallet to send transactions
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><span>📤</span> Send XLM</div>
        {(status === 'success' || status === 'error') && (
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            New Transaction
          </button>
        )}
      </div>

      {status !== 'success' && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="send-destination">Destination Address</label>
            <input
              id="send-destination"
              className={`form-input form-input-mono ${validationErrors.destination ? 'error' : ''}`}
              placeholder="GXXXXXXXXX..."
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value.toUpperCase());
                setValidationErrors((v) => ({ ...v, destination: null }));
              }}
              disabled={status !== 'idle'}
              style={validationErrors.destination ? { borderColor: 'var(--error)' } : {}}
            />
            {validationErrors.destination && (
              <p className="form-error">{validationErrors.destination}</p>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="send-amount">Amount (XLM)</label>
              <input
                id="send-amount"
                className="form-input"
                type="number"
                step="0.0000001"
                min="0.0000001"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setValidationErrors((v) => ({ ...v, amount: null }));
                }}
                disabled={status !== 'idle'}
                style={validationErrors.amount ? { borderColor: 'var(--error)' } : {}}
              />
              {validationErrors.amount && (
                <p className="form-error">{validationErrors.amount}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="send-memo">Memo (optional)</label>
              <input
                id="send-memo"
                className="form-input"
                placeholder="Payment note..."
                value={memo}
                onChange={(e) => {
                  setMemo(e.target.value);
                  setValidationErrors((v) => ({ ...v, memo: null }));
                }}
                disabled={status !== 'idle'}
                maxLength={28}
                style={validationErrors.memo ? { borderColor: 'var(--error)' } : {}}
              />
              {validationErrors.memo && (
                <p className="form-error">{validationErrors.memo}</p>
              )}
              <p className="form-hint">{memo.length}/28 characters</p>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={status !== 'idle' || !destination || !amount}
            id="send-submit-btn"
          >
            {status === 'building' && '⟳ Building Transaction...'}
            {status === 'signing' && '✍ Waiting for Signature...'}
            {status === 'submitting' && '📡 Submitting to Network...'}
            {status === 'idle' && '🚀 Send XLM'}
          </button>
        </form>
      )}

      {/* Success */}
      {status === 'success' && txHash && (
        <div className="tx-status tx-status-success">
          <div className="tx-status-icon">✓</div>
          <div className="tx-status-content">
            <div className="tx-status-title">Transaction Successful!</div>
            <div className="tx-status-message">
              Sent {amount} XLM to {truncateAddress(destination)}
            </div>
            <a
              href={getExplorerUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-hash-link"
            >
              View on Stellar Expert: {truncateAddress(txHash, 8, 8)}
            </a>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="tx-status tx-status-error">
          <div className="tx-status-icon">{error.icon || '✗'}</div>
          <div className="tx-status-content">
            <div className="tx-status-title">{error.name || 'Transaction Failed'}</div>
            <div className="tx-status-message">{error.userMessage || error.message}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={reset}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
