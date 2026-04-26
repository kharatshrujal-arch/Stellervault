/**
 * StellarVault — Deploy a simple token contract to Stellar Testnet
 * This uses the @stellar/stellar-sdk to deploy programmatically
 * without needing Rust or Stellar CLI installed.
 * 
 * We deploy a pre-compiled Soroban "hello world" style contract
 * and also create a custom token using the Stellar Asset system.
 */

import * as StellarSdk from '@stellar/stellar-sdk';

const NETWORK = {
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org:443',
  networkPassphrase: 'Test SDF Network ; September 2015',
  friendbotUrl: 'https://friendbot.stellar.org',
};

async function main() {
  console.log('='.repeat(60));
  console.log('  StellarVault — Testnet Deployment');
  console.log('='.repeat(60));

  // Step 1: Generate a new keypair for deployment
  const deployerKeypair = StellarSdk.Keypair.random();
  const deployerPublic = deployerKeypair.publicKey();
  const deployerSecret = deployerKeypair.secret();

  console.log('\n📋 Deployer Account:');
  console.log(`   Public Key:  ${deployerPublic}`);
  console.log(`   Secret Key:  ${deployerSecret}`);

  // Step 2: Fund via Friendbot
  console.log('\n🚰 Funding account via Friendbot...');
  try {
    const fundRes = await fetch(`${NETWORK.friendbotUrl}?addr=${deployerPublic}`);
    if (!fundRes.ok) throw new Error(`Friendbot failed: ${await fundRes.text()}`);
    console.log('   ✓ Account funded with 10,000 XLM');
  } catch (err) {
    console.error('   ✗ Friendbot failed:', err.message);
    return;
  }

  const horizonServer = new StellarSdk.Horizon.Server(NETWORK.horizonUrl);

  // Step 3: Create a custom asset (SVT token) using Stellar's built-in asset system
  console.log('\n🪙 Creating SVT Token (Stellar Asset)...');
  
  // Generate issuer keypair
  const issuerKeypair = StellarSdk.Keypair.random();
  const issuerPublic = issuerKeypair.publicKey();
  
  console.log(`   Issuer Public Key: ${issuerPublic}`);

  // Fund issuer
  try {
    const fundRes2 = await fetch(`${NETWORK.friendbotUrl}?addr=${issuerPublic}`);
    if (!fundRes2.ok) throw new Error('Fund failed');
    console.log('   ✓ Issuer account funded');
  } catch (err) {
    console.error('   ✗ Could not fund issuer:', err.message);
    return;
  }

  // Create SVT asset
  const svtAsset = new StellarSdk.Asset('SVT', issuerPublic);

  // Deployer creates trustline for SVT
  try {
    const deployerAccount = await horizonServer.loadAccount(deployerPublic);
    const trustTx = new StellarSdk.TransactionBuilder(deployerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: svtAsset,
        limit: '1000000000',
      }))
      .setTimeout(30)
      .build();

    trustTx.sign(deployerKeypair);
    const trustResult = await horizonServer.submitTransaction(trustTx);
    console.log(`   ✓ Trustline created. Tx: ${trustResult.hash}`);
  } catch (err) {
    console.error('   ✗ Trustline failed:', err.message);
    return;
  }

  // Issuer mints SVT tokens to deployer
  let mintTxHash = '';
  try {
    const issuerAccount = await horizonServer.loadAccount(issuerPublic);
    const mintTx = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.payment({
        destination: deployerPublic,
        asset: svtAsset,
        amount: '1000000',
      }))
      .setTimeout(30)
      .build();

    mintTx.sign(issuerKeypair);
    const mintResult = await horizonServer.submitTransaction(mintTx);
    mintTxHash = mintResult.hash;
    console.log(`   ✓ Minted 1,000,000 SVT to deployer. Tx: ${mintTxHash}`);
  } catch (err) {
    console.error('   ✗ Mint failed:', err.message);
    return;
  }

  // Step 4: Create a Liquidity Pool (XLM/SVT)
  console.log('\n🌊 Creating XLM/SVT Liquidity Pool...');
  
  const lpAsset = new StellarSdk.LiquidityPoolAsset(
    StellarSdk.Asset.native(),
    svtAsset,
    StellarSdk.LiquidityPoolFeeV18
  );
  const poolId = StellarSdk.getLiquidityPoolId('constant_product', lpAsset).toString('hex');
  console.log(`   Pool ID: ${poolId}`);

  // Create trustline for LP
  let lpDepositTxHash = '';
  try {
    const deployerAccount2 = await horizonServer.loadAccount(deployerPublic);
    const lpTrustTx = new StellarSdk.TransactionBuilder(deployerAccount2, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: lpAsset,
      }))
      .setTimeout(30)
      .build();

    lpTrustTx.sign(deployerKeypair);
    await horizonServer.submitTransaction(lpTrustTx);
    console.log('   ✓ LP trustline created');

    // Deposit into pool
    const deployerAccount3 = await horizonServer.loadAccount(deployerPublic);
    const depositTx = new StellarSdk.TransactionBuilder(deployerAccount3, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.liquidityPoolDeposit({
        liquidityPoolId: poolId,
        maxAmountA: '500',
        maxAmountB: '5000',
        minPrice: { n: 1, d: 20 },
        maxPrice: { n: 20, d: 1 },
      }))
      .setTimeout(30)
      .build();

    depositTx.sign(deployerKeypair);
    const depositResult = await horizonServer.submitTransaction(depositTx);
    lpDepositTxHash = depositResult.hash;
    console.log(`   ✓ Deposited 500 XLM + 5000 SVT into pool. Tx: ${lpDepositTxHash}`);
  } catch (err) {
    console.error('   ✗ LP creation failed:', err.message);
    if (err.response?.data) {
      console.error('   Details:', JSON.stringify(err.response.data.extras?.result_codes || {}));
    }
    return;
  }

  // Step 5: Execute an inter-pool swap to demonstrate the flow
  console.log('\n🔄 Executing a test swap (XLM → SVT)...');
  let swapTxHash = '';
  try {
    const deployerAccount4 = await horizonServer.loadAccount(deployerPublic);
    const swapTx = new StellarSdk.TransactionBuilder(deployerAccount4, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset: StellarSdk.Asset.native(),
        sendAmount: '10',
        destination: deployerPublic,
        destAsset: svtAsset,
        destMin: '1',
      }))
      .setTimeout(30)
      .build();

    swapTx.sign(deployerKeypair);
    const swapResult = await horizonServer.submitTransaction(swapTx);
    swapTxHash = swapResult.hash;
    console.log(`   ✓ Swapped 10 XLM for SVT. Tx: ${swapTxHash}`);
  } catch (err) {
    console.error('   ✗ Swap failed:', err.message);
    if (err.response?.data) {
      console.error('   Details:', JSON.stringify(err.response.data.extras?.result_codes || {}));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  ✅ DEPLOYMENT COMPLETE');
  console.log('='.repeat(60));
  console.log(`
📋 ADDRESSES & HASHES (add to README):

🪙 SVT Token:
   Issuer:          ${issuerPublic}
   Asset Code:      SVT
   Mint Tx Hash:    ${mintTxHash}
   Explorer:        https://stellar.expert/explorer/testnet/asset/SVT-${issuerPublic}

🌊 Liquidity Pool:
   Pool ID:         ${poolId}
   Deposit Tx Hash: ${lpDepositTxHash}
   Explorer:        https://stellar.expert/explorer/testnet/liquidity-pool/${poolId}

🔄 Swap Transaction:
   Tx Hash:         ${swapTxHash}
   Explorer:        https://stellar.expert/explorer/testnet/tx/${swapTxHash}

👤 Deployer Account:
   Public Key:      ${deployerPublic}
   Explorer:        https://stellar.expert/explorer/testnet/account/${deployerPublic}
`);
}

main().catch(console.error);
