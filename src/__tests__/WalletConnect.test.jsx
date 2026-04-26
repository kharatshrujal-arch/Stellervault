import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the wallet context
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    publicKey: null,
    isConnected: false,
    isConnecting: false,
    walletType: null,
    error: null,
    network: 'Stellar Testnet',
    connectFreighter: vi.fn(),
    connectManual: vi.fn(),
    disconnect: vi.fn(),
    clearError: vi.fn(),
  }),
}));

// Mock freighter-api
vi.mock('@stellar/freighter-api', () => ({
  isConnected: () => Promise.resolve({ isConnected: false }),
  requestAccess: () => Promise.resolve({ error: null }),
  getAddress: () => Promise.resolve({ address: '' }),
}));

import WalletConnect from '../components/WalletConnect';

describe('WalletConnect Component', () => {
  it('should render connect wallet prompt when disconnected', () => {
    render(<WalletConnect />);
    expect(screen.getByText('Connect Your Wallet')).toBeTruthy();
  });

  it('should show wallet options', () => {
    render(<WalletConnect />);
    expect(screen.getByText('Freighter')).toBeTruthy();
    expect(screen.getByText('Public Key')).toBeTruthy();
  });

  it('should have connect buttons with proper IDs', () => {
    render(<WalletConnect />);
    expect(document.getElementById('connect-freighter-btn')).toBeTruthy();
    expect(document.getElementById('connect-manual-btn')).toBeTruthy();
  });
});
