import { useState, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { CONTRACTS, CURRENT_NETWORK } from '../utils/constants';
import { isValidPublicKey, isValidAmount, truncateAddress, formatBalance, classifyError, ContractError } from '../utils/errors';
import * as StellarSdk from '@stellar/stellar-sdk';

export default function TokenPanel() {
  const { publicKey, isConnected, signTransaction } = useWallet();
  const [activeTab, setActiveTab] = useState('mint');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Mint form
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('');

  // Transfer form
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const contractId = CONTRACTS.TOKEN.id;

  const invokeContract = useCallback(async (functionName, args) => {
    if (!publicKey) throw new Error('No wallet connected');
    
    setStatus('building');
    setResult(null);
    setError(null);

    try {
      if (!contractId) {
        throw new ContractError(
          'Token contract not yet deployed. Deploy the contract first and update the contract ID in constants.js',
          '',
          functionName
        );
      }

      const server = new StellarSdk.rpc.Server(CURRENT_NETWORK.sorobanRpcUrl);
      const sourceAccount = await server.getAccount(publicKey);

      const contract = new StellarSdk.Contract(contractId);
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: CURRENT_NETWORK.networkPassphrase,
      })
        .addOperation(contract.call(functionName, ...args))
        .setTimeout(30)
        .build();

      // Simulate first
      setStatus('simulating');
      const simResult = await server.simulateTransaction(transaction);
      
      if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
        throw new ContractError(
          `Simulation failed: ${simResult.error}`,
          contractId,
          functionName
        );
      }

      const preparedTx = StellarSdk.rpc.assembleTransaction(transaction, simResult).build();

      // Sign
      setStatus('signing');
      const signedXdr = await signTransaction(preparedTx.toXDR());

      // Submit
      setStatus('submitting');
      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signedXdr,
        CURRENT_NETWORK.networkPassphrase
      );
      const sendResult = await server.sendTransaction(signedTx);

      // Poll for confirmation
      if (sendResult.status === 'PENDING') {
        let getResult = await server.getTransaction(sendResult.hash);
        while (getResult.status === 'NOT_FOUND') {
          await new Promise((r) => setTimeout(r, 1000));
          getResult = await server.getTransaction(sendResult.hash);
        }

        if (getResult.status === 'SUCCESS') {
          setResult({ type: 'success', hash: sendResult.hash, message: `${functionName} executed successfully!` });
          setStatus('success');
          return getResult;
        } else {
          throw new ContractError(`Transaction failed: ${getResult.status}`, contractId, functionName);
        }
      } else if (sendResult.status === 'ERROR') {
        throw new ContractError(`Transaction error: ${sendResult.errorResult}`, contractId, functionName);
      }

      setResult({ type: 'success', hash: sendResult.hash, message: `${functionName} executed successfully!` });
      setStatus('success');
      return sendResult;
    } catch (err) {
      const classified = classifyError(err);
      setError(classified);
      setStatus('error');
    }
  }, [publicKey, signTransaction, contractId]);

  const handleMint = async (e) => {
    e.preventDefault();
    const toAddr = mintTo || publicKey;
    await invokeContract('mint', [
      new StellarSdk.Address(toAddr).toScVal(),
      StellarSdk.nativeToScVal(parseInt(mintAmount) * 10000000, { type: 'i128' }),
    ]);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    await invokeContract('transfer', [
      new StellarSdk.Address(publicKey).toScVal(),
      new StellarSdk.Address(transferTo).toScVal(),
      StellarSdk.nativeToScVal(parseInt(transferAmount) * 10000000, { type: 'i128' }),
    ]);
  };

  const resetForm = () => {
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  if (!isConnected) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span>🪙</span> SVT Token</div>
        </div>
        <div className="text-center text-secondary" style={{ padding: '2rem 0' }}>
          Connect wallet to interact with the token contract
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🪙</span> {CONTRACTS.TOKEN.name}
          <span className="badge badge-info">{CONTRACTS.TOKEN.symbol}</span>
        </div>
        {(status === 'success' || status === 'error') && (
          <button className="btn btn-secondary btn-sm" onClick={resetForm}>Reset</button>
        )}
      </div>

      {!contractId && (
        <div className="tx-status tx-status-pending mb-4" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}>
          <div className="tx-status-icon" style={{ background: 'var(--warning)' }}>⚠</div>
          <div className="tx-status-content">
            <div className="tx-status-title">Contract Not Deployed</div>
            <div className="tx-status-message">
              The token contract needs to be deployed to testnet. See the README for deployment instructions. You can still explore the UI.
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="app-nav mb-4">
        <button
          className={`nav-btn ${activeTab === 'mint' ? 'active' : ''}`}
          onClick={() => { setActiveTab('mint'); resetForm(); }}
        >
          🔨 Mint
        </button>
        <button
          className={`nav-btn ${activeTab === 'transfer' ? 'active' : ''}`}
          onClick={() => { setActiveTab('transfer'); resetForm(); }}
        >
          📤 Transfer
        </button>
      </div>

      {/* Mint */}
      {activeTab === 'mint' && status !== 'success' && (
        <form onSubmit={handleMint}>
          <div className="form-group">
            <label className="form-label">Mint To (leave empty for self)</label>
            <input
              className="form-input form-input-mono"
              placeholder={truncateAddress(publicKey, 12, 8) + ' (self)'}
              value={mintTo}
              onChange={(e) => setMintTo(e.target.value.toUpperCase())}
              disabled={status !== 'idle'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Amount</label>
            <input
              className="form-input"
              type="number"
              placeholder="1000"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              disabled={status !== 'idle'}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={status !== 'idle' || !mintAmount}
          >
            {status === 'idle' ? '🔨 Mint SVT Tokens' : `⟳ ${status}...`}
          </button>
        </form>
      )}

      {/* Transfer */}
      {activeTab === 'transfer' && status !== 'success' && (
        <form onSubmit={handleTransfer}>
          <div className="form-group">
            <label className="form-label">Destination</label>
            <input
              className="form-input form-input-mono"
              placeholder="GXXXXXXXXX..."
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value.toUpperCase())}
              disabled={status !== 'idle'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Amount</label>
            <input
              className="form-input"
              type="number"
              placeholder="100"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              disabled={status !== 'idle'}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={status !== 'idle' || !transferTo || !transferAmount}
          >
            {status === 'idle' ? '📤 Transfer SVT' : `⟳ ${status}...`}
          </button>
        </form>
      )}

      {/* Result */}
      {result && (
        <div className={`tx-status tx-status-${result.type}`}>
          <div className="tx-status-icon">✓</div>
          <div className="tx-status-content">
            <div className="tx-status-title">{result.message}</div>
            {result.hash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${result.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-hash-link"
              >
                Tx: {truncateAddress(result.hash, 8, 8)}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="tx-status tx-status-error">
          <div className="tx-status-icon">{error.icon || '✗'}</div>
          <div className="tx-status-content">
            <div className="tx-status-title">{error.name}</div>
            <div className="tx-status-message">{error.userMessage || error.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}
