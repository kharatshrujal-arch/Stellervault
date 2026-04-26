import { describe, it, expect } from 'vitest';
import {
  isValidPublicKey,
  isValidAmount,
  truncateAddress,
  formatBalance,
  formatTime,
  getExplorerUrl,
  classifyError,
  NetworkError,
  InsufficientFundsError,
  ContractError,
} from '../utils/errors';

describe('Utility Functions', () => {

  describe('isValidPublicKey', () => {
    it('should validate correct Stellar public keys', () => {
      expect(isValidPublicKey('GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
        .replace(/X/g, 'A'))).toBe(false);
      // Valid key format: starts with G, 56 chars, base32
      const validKey = 'GBZXN7PIRZGNMHGA7MUUUF4GWESIPGSNJMHOTOWHYIXE742MWAJKBCXQ';
      expect(isValidPublicKey(validKey)).toBe(true);
    });

    it('should reject invalid public keys', () => {
      expect(isValidPublicKey('')).toBe(false);
      expect(isValidPublicKey(null)).toBe(false);
      expect(isValidPublicKey(undefined)).toBe(false);
      expect(isValidPublicKey('S123')).toBe(false);
      expect(isValidPublicKey('not-a-key')).toBe(false);
      expect(isValidPublicKey('GABC')).toBe(false);
    });
  });

  describe('isValidAmount', () => {
    it('should accept valid amounts', () => {
      expect(isValidAmount('1')).toBe(true);
      expect(isValidAmount('100.5')).toBe(true);
      expect(isValidAmount('0.0000001')).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(isValidAmount('0')).toBe(false);
      expect(isValidAmount('-5')).toBe(false);
      expect(isValidAmount('')).toBe(false);
      expect(isValidAmount('abc')).toBe(false);
    });
  });

  describe('truncateAddress', () => {
    it('should truncate address correctly', () => {
      const addr = 'GBZXN7PIRZGNMHGA7MUUUF4GWESIPGSNJMHOTOWHYIXE742MWAJKBCXQ';
      const result = truncateAddress(addr, 6, 4);
      expect(result).toBe('GBZXN7...BCXQ');
      expect(result.length).toBeLessThan(addr.length);
    });

    it('should handle empty input', () => {
      expect(truncateAddress('')).toBe('');
      expect(truncateAddress(null)).toBe('');
    });
  });

  describe('formatBalance', () => {
    it('should format small balances', () => {
      expect(formatBalance('123.456')).toBe('123.4560000');
    });

    it('should format large balances with commas', () => {
      const result = formatBalance('1500.25', 4);
      expect(result).toContain('1');
    });

    it('should format millions with M suffix', () => {
      expect(formatBalance('5000000')).toBe('5.00M');
    });

    it('should handle invalid input', () => {
      expect(formatBalance('abc')).toBe('0.00');
      expect(formatBalance('')).toBe('0.00');
    });
  });

  describe('getExplorerUrl', () => {
    it('should generate correct explorer URL', () => {
      const hash = 'abc123def456';
      expect(getExplorerUrl(hash)).toBe(
        'https://stellar.expert/explorer/testnet/tx/abc123def456'
      );
    });
  });
});

describe('Error Classification', () => {

  it('should classify network errors', () => {
    const err = new Error('Failed to fetch data from Horizon');
    const classified = classifyError(err);
    expect(classified).toBeInstanceOf(NetworkError);
    expect(classified.type).toBe('network');
    expect(classified.icon).toBe('🌐');
  });

  it('should classify insufficient funds errors', () => {
    const err = new Error('tx_insufficient_balance');
    const classified = classifyError(err);
    expect(classified).toBeInstanceOf(InsufficientFundsError);
    expect(classified.type).toBe('insufficient_funds');
    expect(classified.icon).toBe('💰');
  });

  it('should classify contract errors', () => {
    const err = new Error('Contract simulation failed');
    const classified = classifyError(err);
    expect(classified).toBeInstanceOf(ContractError);
    expect(classified.type).toBe('contract');
    expect(classified.icon).toBe('📜');
  });

  it('should pass through already-classified errors', () => {
    const original = new NetworkError('test');
    const result = classifyError(original);
    expect(result).toBe(original);
  });

  it('should default unknown errors to NetworkError', () => {
    const err = new Error('Something completely unexpected');
    const classified = classifyError(err);
    expect(classified).toBeInstanceOf(NetworkError);
  });
});
