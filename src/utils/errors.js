/**
 * StellarVault — Custom Error Types
 * Three distinct error types for comprehensive error handling
 */

export class NetworkError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'NetworkError';
    this.type = 'network';
    this.originalError = originalError;
    this.userMessage = 'Network connection issue. Please check your internet and try again.';
    this.icon = '🌐';
  }
}

export class InsufficientFundsError extends Error {
  constructor(message, required = 0, available = 0) {
    super(message);
    this.name = 'InsufficientFundsError';
    this.type = 'insufficient_funds';
    this.required = required;
    this.available = available;
    this.userMessage = `Insufficient balance. Required: ${required} XLM, Available: ${available} XLM`;
    this.icon = '💰';
  }
}

export class ContractError extends Error {
  constructor(message, contractId = '', functionName = '', originalError = null) {
    super(message);
    this.name = 'ContractError';
    this.type = 'contract';
    this.contractId = contractId;
    this.functionName = functionName;
    this.originalError = originalError;
    this.userMessage = `Smart contract error: ${message}`;
    this.icon = '📜';
  }
}

/**
 * Classifies an error into one of our three types
 */
export function classifyError(error) {
  if (error instanceof NetworkError || error instanceof InsufficientFundsError || error instanceof ContractError) {
    return error;
  }

  const message = (error?.message || error?.toString() || '').toLowerCase();

  // Network-related errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('horizon') ||
    message.includes('soroban') ||
    message.includes('rpc') ||
    message.includes('failed to fetch') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504')
  ) {
    return new NetworkError(error.message, error);
  }

  // Insufficient funds errors
  if (
    message.includes('insufficient') ||
    message.includes('underfunded') ||
    message.includes('balance') ||
    message.includes('not enough') ||
    message.includes('op_underfunded') ||
    message.includes('tx_insufficient_balance')
  ) {
    return new InsufficientFundsError(error.message);
  }

  // Contract errors
  if (
    message.includes('contract') ||
    message.includes('invoke') ||
    message.includes('wasm') ||
    message.includes('host function') ||
    message.includes('scval') ||
    message.includes('unauthorized') ||
    message.includes('simulation')
  ) {
    return new ContractError(error.message, '', '', error);
  }

  // Default to network error
  return new NetworkError(error.message || 'An unexpected error occurred', error);
}

/**
 * Validates a Stellar public key
 */
export function isValidPublicKey(key) {
  if (!key || typeof key !== 'string') return false;
  return /^G[A-Z2-7]{55}$/.test(key);
}

/**
 * Validates a Stellar amount
 */
export function isValidAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 10000000000;
}

/**
 * Format a Stellar public key for display
 */
export function truncateAddress(address, start = 6, end = 4) {
  if (!address) return '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/**
 * Format a balance with commas and decimals
 */
export function formatBalance(balance, decimals = 7) {
  const num = parseFloat(balance);
  if (isNaN(num)) return '0.00';
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4 
    });
  }
  return num.toFixed(Math.min(decimals, 7));
}

/**
 * Format a date for event log
 */
export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(hash, type = 'tx') {
  return `https://stellar.expert/explorer/testnet/${type}/${hash}`;
}
