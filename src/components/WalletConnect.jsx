import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { truncateAddress } from '../utils/errors';

export default function WalletConnect() {
  const {
    publicKey,
    walletType,
    isConnecting,
    isConnected,
    error,
    network,
    connectFreighter,
    connectManual,
    disconnect,
    clearError,
  } = useWallet();

  const [freighterAvailable, setFreighterAvailable] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const freighterApi = await import('@stellar/freighter-api');
        const result = await freighterApi.isConnected();
        setFreighterAvailable(result.isConnected);
      } catch {
        setFreighterAvailable(false);
      }
    })();
  }, []);

  const handleCopyAddress = useCallback(() => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [publicKey]);

  const handleManualConnect = useCallback(() => {
    if (manualKey && /^G[A-Z2-7]{55}$/.test(manualKey)) {
      connectManual(manualKey);
      setShowManualInput(false);
      setManualKey('');
    }
  }, [manualKey, connectManual]);

  // Connected state
  if (isConnected) {
    return (
      <div className="card card-accent">
        <div className="card-header">
          <div className="card-title">
            <span>🔗</span> Wallet Connected
          </div>
          <span className="badge badge-success">
            <span className="wallet-status-dot" style={{ width: 6, height: 6 }}></span>
            {walletType}
          </span>
        </div>

        <div className="wallet-connected">
          <div
            className="wallet-address"
            onClick={handleCopyAddress}
            title="Click to copy full address"
            id="wallet-address-display"
          >
            {truncateAddress(publicKey, 8, 6)}
          </div>
          <span className="badge badge-info">{network}</span>
          <button className="btn btn-secondary btn-sm" onClick={disconnect} id="disconnect-btn">
            Disconnect
          </button>
        </div>

        {copied && (
          <div className="mt-2 text-xs text-success">✓ Address copied to clipboard</div>
        )}

        {error && (
          <div className="tx-status tx-status-error mt-3">
            <div className="tx-status-icon">{error.icon || '⚠️'}</div>
            <div className="tx-status-content">
              <div className="tx-status-title">{error.name}</div>
              <div className="tx-status-message">{error.userMessage || error.message}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Disconnected — show connection options
  return (
    <div className="card">
      <div className="wallet-connect-section">
        <h1 className="hero-title">Connect Your Wallet</h1>
        <p className="hero-subtitle">
          Choose a wallet to connect to StellarVault on the Stellar Testnet
        </p>

        <div className="wallet-options">
          {/* Freighter */}
          <button
            className="wallet-option"
            onClick={connectFreighter}
            disabled={isConnecting}
            id="connect-freighter-btn"
          >
            <div className="wallet-option-icon">🦊</div>
            <div className="wallet-option-name">Freighter</div>
            <div className="wallet-option-desc">
              {freighterAvailable ? (
                <span className="text-success">● Detected</span>
              ) : (
                <span className="text-warning">Not installed</span>
              )}
            </div>
          </button>

          {/* Manual / Demo */}
          <button
            className="wallet-option"
            onClick={() => setShowManualInput(true)}
            disabled={isConnecting}
            id="connect-manual-btn"
          >
            <div className="wallet-option-icon">🔑</div>
            <div className="wallet-option-name">Public Key</div>
            <div className="wallet-option-desc">Enter manually</div>
          </button>
        </div>

        {isConnecting && (
          <div className="tx-status tx-status-pending">
            <div className="tx-status-icon">⟳</div>
            <div className="tx-status-content">
              <div className="tx-status-title">Connecting...</div>
              <div className="tx-status-message">Please confirm in your wallet extension</div>
            </div>
          </div>
        )}

        {showManualInput && (
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <div className="form-group">
              <label className="form-label">Stellar Public Key</label>
              <input
                className="form-input form-input-mono"
                placeholder="G..."
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value.toUpperCase())}
                id="manual-key-input"
              />
              <p className="form-hint">Enter a valid Stellar public key starting with G</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={handleManualConnect}
                disabled={!/^G[A-Z2-7]{55}$/.test(manualKey)}
                id="manual-connect-submit"
              >
                Connect
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowManualInput(false);
                  setManualKey('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="tx-status tx-status-error mt-4">
            <div className="tx-status-icon">{error.icon || '⚠️'}</div>
            <div className="tx-status-content">
              <div className="tx-status-title">{error.name}</div>
              <div className="tx-status-message">{error.userMessage || error.message}</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
