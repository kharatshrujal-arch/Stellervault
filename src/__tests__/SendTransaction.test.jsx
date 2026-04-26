import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the wallet context — disconnected state
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    publicKey: null,
    isConnected: false,
    signTransaction: vi.fn(),
  }),
}));

import SendTransaction from '../components/SendTransaction';

describe('SendTransaction Component', () => {
  it('should show connect prompt when wallet not connected', () => {
    render(<SendTransaction />);
    expect(screen.getByText('Connect wallet to send transactions')).toBeTruthy();
  });

  it('should render Send XLM title', () => {
    render(<SendTransaction />);
    expect(screen.getByText(/Send XLM/)).toBeTruthy();
  });

  it('should render the card container', () => {
    const { container } = render(<SendTransaction />);
    expect(container.querySelector('.card')).toBeTruthy();
  });

  it('should display a styled card UI element', () => {
    const { container } = render(<SendTransaction />);
    const card = container.querySelector('.card');
    expect(card).toBeTruthy();
    expect(card.querySelector('.card-title')).toBeTruthy();
  });
});
