/**
 * StellarVault — Stellar Network Configuration
 */

export const NETWORKS = {
  TESTNET: {
    name: 'Stellar Testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org:443',
    friendbotUrl: 'https://friendbot.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
  },
};

export const CURRENT_NETWORK = NETWORKS.TESTNET;

// Pre-deployed contract IDs on testnet
// These are example contract IDs - they will be replaced after actual deployment
export const CONTRACTS = {
  TOKEN: {
    id: '', // Will be set after deployment
    name: 'StellarVault Token',
    symbol: 'SVT',
    decimals: 7,
  },
  POOL: {
    id: '', // Will be set after deployment
    name: 'SVT/XLM Liquidity Pool',
  },
};

// Wallet types
export const WALLET_TYPES = {
  FREIGHTER: 'freighter',
  ALBEDO: 'albedo',
  MANUAL: 'manual',
};
