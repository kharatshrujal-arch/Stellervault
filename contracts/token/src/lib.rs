#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Vec,
    log,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    Balance(Address),
    Allowance(Address, Address),
    TotalSupply,
}

#[contract]
pub struct StellarVaultToken;

#[contractimpl]
impl StellarVaultToken {
    /// Initialize the token with name, symbol, decimals, and admin
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String, decimals: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);

        log!(&env, "StellarVault Token initialized: {} ({})", name, symbol);
    }

    /// Mint tokens (admin only)
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(balance + amount));

        let total: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total + amount));

        log!(&env, "Minted {} tokens to {}", amount, to);
    }

    /// Transfer tokens from one address to another
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let from_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);

        if from_balance < amount {
            panic!("Insufficient balance");
        }

        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_balance + amount));

        log!(&env, "Transferred {} tokens from {} to {}", amount, from, to);
    }

    /// Get balance for an address
    pub fn balance(env: Env, addr: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(addr))
            .unwrap_or(0)
    }

    /// Approve spender to spend tokens on behalf of from
    pub fn approve(env: Env, from: Address, spender: Address, amount: i128) {
        from.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Allowance(from.clone(), spender.clone()), &amount);

        log!(&env, "Approved {} to spend {} on behalf of {}", spender, amount, from);
    }

    /// Get allowance
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(from, spender))
            .unwrap_or(0)
    }

    /// Transfer from with allowance
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        let allowance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Allowance(from.clone(), spender.clone()))
            .unwrap_or(0);

        if allowance < amount {
            panic!("Insufficient allowance");
        }

        let from_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);

        if from_balance < amount {
            panic!("Insufficient balance");
        }

        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);

        env.storage()
            .persistent()
            .set(&DataKey::Allowance(from.clone(), spender), &(allowance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(to_balance + amount));
    }

    /// Get total supply
    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    /// Get token name
    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).unwrap()
    }

    /// Get token symbol
    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).unwrap()
    }

    /// Get decimals
    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap()
    }
}
