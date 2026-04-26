import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { WALLET_TYPES, CURRENT_NETWORK } from '../utils/constants';
import { classifyError } from '../utils/errors';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [walletType, setWalletType] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [network, setNetwork] = useState(CURRENT_NETWORK.name);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Check if Freighter is installed
  const isFreighterInstalled = useCallback(async () => {
    try {
      const freighterApi = await import('@stellar/freighter-api');
      const result = await freighterApi.isConnected();
      return result.isConnected;
    } catch {
      return false;
    }
  }, []);

  // Connect via Freighter
  const connectFreighter = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const freighterApi = await import('@stellar/freighter-api');

      const connected = await freighterApi.isConnected();
      if (!connected.isConnected) {
        throw new Error('Freighter extension is not installed. Please install it from freighter.app');
      }

      const accessResult = await freighterApi.requestAccess();
      if (accessResult.error) {
        throw new Error(accessResult.error);
      }

      const addressResult = await freighterApi.getAddress();
      if (addressResult.error) {
        throw new Error(addressResult.error);
      }

      if (mountedRef.current) {
        setPublicKey(addressResult.address);
        setWalletType(WALLET_TYPES.FREIGHTER);
        setNetwork(CURRENT_NETWORK.name);
      }
    } catch (err) {
      const classified = classifyError(err);
      if (mountedRef.current) setError(classified);
      throw classified;
    } finally {
      if (mountedRef.current) setIsConnecting(false);
    }
  }, []);

  // Connect with a manual public key (for testing / demo)
  const connectManual = useCallback((key) => {
    setPublicKey(key);
    setWalletType(WALLET_TYPES.MANUAL);
    setNetwork(CURRENT_NETWORK.name);
    setError(null);
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    setPublicKey(null);
    setWalletType(null);
    setError(null);
  }, []);

  // Sign transaction via connected wallet
  const signTransaction = useCallback(async (xdr) => {
    if (!publicKey || !walletType) {
      throw new Error('No wallet connected');
    }

    if (walletType === WALLET_TYPES.FREIGHTER) {
      const freighterApi = await import('@stellar/freighter-api');
      const result = await freighterApi.signTransaction(xdr, {
        networkPassphrase: CURRENT_NETWORK.networkPassphrase,
        address: publicKey,
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.signedTxXdr;
    }

    throw new Error('Unsupported wallet type for signing');
  }, [publicKey, walletType]);

  const value = {
    publicKey,
    walletType,
    isConnecting,
    isConnected: !!publicKey,
    error,
    network,
    connectFreighter,
    connectManual,
    disconnect,
    signTransaction,
    isFreighterInstalled,
    clearError: () => setError(null),
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
