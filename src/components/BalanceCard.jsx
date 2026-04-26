import { useBalance, fundWithFriendbot } from '../hooks/useStellar';
import { useWallet } from '../context/WalletContext';
import { formatBalance } from '../utils/errors';
import { useState } from 'react';

export default function BalanceCard() {
  const { publicKey, isConnected } = useWallet();
  const { balance, balances, loading, error, refetch } = useBalance(publicKey);
  const [funding, setFunding] = useState(false);
  const [fundResult, setFundResult] = useState(null);

  const handleFund = async () => {
    if (!publicKey) return;
    setFunding(true);
    setFundResult(null);
    try {
      await fundWithFriendbot(publicKey);
      setFundResult({ type: 'success', message: '10,000 XLM funded from Friendbot!' });
      refetch();
    } catch (err) {
      setFundResult({ type: 'error', message: err.userMessage || err.message });
    } finally {
      setFunding(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span>💰</span> Balance</div>
        </div>
        <div className="balance-display">
          <div className="text-secondary">Connect wallet to view balance</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-accent">
      <div className="card-header">
        <div className="card-title"><span>💰</span> Balance</div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={refetch}
            disabled={loading}
            id="refresh-balance-btn"
          >
            {loading ? '⟳' : '↻'} Refresh
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleFund}
            disabled={funding}
            id="fund-account-btn"
          >
            {funding ? '⟳ Funding...' : '🚰 Friendbot'}
          </button>
        </div>
      </div>

      {/* Main XLM Balance */}
      <div className="balance-display">
        {loading && !balance ? (
          <div className="skeleton" style={{ height: 48, width: 200, margin: '0 auto' }}></div>
        ) : (
          <>
            <div className="balance-amount" id="xlm-balance">
              {formatBalance(balance || '0', 4)}
            </div>
            <div className="balance-currency">XLM</div>
          </>
        )}
      </div>

      <div className="divider"></div>

      {/* All token balances */}
      <div>
        {balances.map((b, i) => (
          <div className="balance-row" key={i}>
            <div className="balance-token-info">
              <div className="balance-token-icon">
                {b.code === 'XLM' ? '⭐' : '🪙'}
              </div>
              <div>
                <div className="balance-token-name">{b.code}</div>
                <div className="balance-token-symbol">
                  {b.type === 'native' ? 'Native' : b.issuer ? `...${b.issuer.slice(-6)}` : ''}
                </div>
              </div>
            </div>
            <div className="balance-token-amount">{formatBalance(b.balance, 4)}</div>
          </div>
        ))}
      </div>

      {/* Fund result */}
      {fundResult && (
        <div className={`tx-status mt-3 tx-status-${fundResult.type === 'success' ? 'success' : 'error'}`}>
          <div className="tx-status-icon">{fundResult.type === 'success' ? '✓' : '✗'}</div>
          <div className="tx-status-content">
            <div className="tx-status-message">{fundResult.message}</div>
          </div>
        </div>
      )}

      {/* Error */}
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
