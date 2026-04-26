#!/bin/bash
# StellarVault — Smart Contract Deployment Script
# Prerequisites: Stellar CLI, Rust toolchain with wasm32-unknown-unknown target
# Usage: ./deploy.sh

set -e

echo "================================================"
echo "  StellarVault — Smart Contract Deployment"
echo "================================================"

# Configure identity (if not already done)
echo ""
echo "Step 1: Setting up deployer identity..."
stellar keys generate deployer --network testnet --fund 2>/dev/null || echo "Identity 'deployer' already exists"

DEPLOYER_ADDRESS=$(stellar keys address deployer)
echo "Deployer address: $DEPLOYER_ADDRESS"

# Build token contract
echo ""
echo "Step 2: Building Token Contract..."
cd token
cargo build --target wasm32-unknown-unknown --release
cd ..

# Deploy token contract
echo ""
echo "Step 3: Deploying Token Contract to Testnet..."
TOKEN_CONTRACT_ID=$(stellar contract deploy \
  --wasm token/target/wasm32-unknown-unknown/release/stellar_vault_token.wasm \
  --source deployer \
  --network testnet)

echo "Token Contract ID: $TOKEN_CONTRACT_ID"

# Initialize token
echo ""
echo "Step 4: Initializing Token Contract..."
stellar contract invoke \
  --id "$TOKEN_CONTRACT_ID" \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --name "StellarVault Token" \
  --symbol "SVT" \
  --decimals 7

echo "Token initialized successfully!"

# Build pool contract
echo ""
echo "Step 5: Building Pool Contract..."
cd pool
cargo build --target wasm32-unknown-unknown --release
cd ..

# Deploy pool contract
echo ""
echo "Step 6: Deploying Pool Contract to Testnet..."
POOL_CONTRACT_ID=$(stellar contract deploy \
  --wasm pool/target/wasm32-unknown-unknown/release/stellar_vault_pool.wasm \
  --source deployer \
  --network testnet)

echo "Pool Contract ID: $POOL_CONTRACT_ID"

# Summary
echo ""
echo "================================================"
echo "  Deployment Complete!"
echo "================================================"
echo ""
echo "Token Contract ID: $TOKEN_CONTRACT_ID"
echo "Pool Contract ID:  $POOL_CONTRACT_ID"
echo ""
echo "Update these IDs in src/utils/constants.js:"
echo ""
echo "  TOKEN: { id: '$TOKEN_CONTRACT_ID', ... }"
echo "  POOL:  { id: '$POOL_CONTRACT_ID', ... }"
echo ""
echo "================================================"
