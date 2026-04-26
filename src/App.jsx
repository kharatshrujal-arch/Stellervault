import { useState } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import WalletConnect from './components/WalletConnect';
import BalanceCard from './components/BalanceCard';
import SendTransaction from './components/SendTransaction';
import TokenPanel from './components/TokenPanel';
import PoolPanel from './components/PoolPanel';
import EventLog from './components/EventLog';

const TABS = [
  { id: 'dashboard', label: '🏠 Dashboard', icon: '🏠' },
  { id: 'send', label: '📤 Send', icon: '📤' },
  { id: 'token', label: '🪙 Token', icon: '🪙' },
  { id: 'pool', label: '🌊 Pool', icon: '🌊' },
  { id: 'events', label: '📡 Events', icon: '📡' },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { isConnected } = useWallet();

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">⭐</div>
          <div>
            <div className="app-logo-text">StellarVault</div>
          </div>
          <span className="app-logo-badge">TESTNET</span>
        </div>

        <nav className="app-nav" id="main-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              id={`nav-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="app-content" key={activeTab}>
        {activeTab === 'dashboard' && (
          <div className="page-grid">
            <div className="page-grid-full">
              <WalletConnect />
            </div>
            {isConnected && (
              <>
                <BalanceCard />
                <EventLog />
              </>
            )}
          </div>
        )}

        {activeTab === 'send' && (
          <div className="page-grid">
            <SendTransaction />
            <EventLog />
          </div>
        )}

        {activeTab === 'token' && (
          <div className="page-grid">
            <TokenPanel />
            <BalanceCard />
          </div>
        )}

        {activeTab === 'pool' && (
          <div className="page-grid">
            <PoolPanel />
            <div>
              <BalanceCard />
              <div className="mt-6">
                <EventLog />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="page-grid">
            <div className="page-grid-full">
              <EventLog />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem 1rem',
        color: 'var(--text-tertiary)',
        fontSize: 'var(--text-xs)',
        borderTop: '1px solid var(--border-subtle)',
        marginTop: '3rem',
      }}>
        <p>StellarVault — Built on Stellar Testnet with Soroban Smart Contracts</p>
        <p style={{ marginTop: '0.25rem' }}>
          <a href="https://stellar.org" target="_blank" rel="noopener noreferrer">Stellar</a>
          {' · '}
          <a href="https://soroban.stellar.org" target="_blank" rel="noopener noreferrer">Soroban</a>
          {' · '}
          <a href="https://freighter.app" target="_blank" rel="noopener noreferrer">Freighter</a>
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}
