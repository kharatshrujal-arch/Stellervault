import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletProvider, useWallet } from '../context/WalletContext';

// Helper to render with provider
function renderWithProvider(ui) {
  return render(<WalletProvider>{ui}</WalletProvider>);
}

// Test component to expose wallet context
function WalletInfo() {
  const { publicKey, isConnected, walletType } = useWallet();
  return (
    <div>
      <span data-testid="connected">{isConnected ? 'yes' : 'no'}</span>
      <span data-testid="publicKey">{publicKey || 'none'}</span>
      <span data-testid="walletType">{walletType || 'none'}</span>
    </div>
  );
}

describe('WalletContext', () => {
  it('should start in disconnected state', () => {
    renderWithProvider(<WalletInfo />);
    expect(screen.getByTestId('connected').textContent).toBe('no');
    expect(screen.getByTestId('publicKey').textContent).toBe('none');
    expect(screen.getByTestId('walletType').textContent).toBe('none');
  });

  it('should provide wallet context values', () => {
    renderWithProvider(<WalletInfo />);
    // Verify it renders without errors
    expect(screen.getByTestId('connected')).toBeTruthy();
  });

  it('should throw if used outside provider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<WalletInfo />);
    }).toThrow('useWallet must be used within WalletProvider');
    
    spy.mockRestore();
  });
});
