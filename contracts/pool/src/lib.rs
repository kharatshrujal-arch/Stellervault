#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, log,
};

#[contracttype]
pub enum PoolDataKey {
    TokenA,
    TokenB,
    ReserveA,
    ReserveB,
    TotalShares,
    Shares(Address),
    Admin,
}

#[contract]
pub struct LiquidityPool;

/// Inter-contract call interface to TokenContract
mod token_contract {
    soroban_sdk::contractimport!(
        file = "../token/target/wasm32-unknown-unknown/release/stellar_vault_token.wasm"
    );
}

#[contractimpl]
impl LiquidityPool {
    /// Initialize the pool with two token contract addresses
    pub fn initialize(env: Env, admin: Address, token_a: Address, token_b: Address) {
        if env.storage().instance().has(&PoolDataKey::Admin) {
            panic!("Already initialized");
        }

        env.storage().instance().set(&PoolDataKey::Admin, &admin);
        env.storage().instance().set(&PoolDataKey::TokenA, &token_a);
        env.storage().instance().set(&PoolDataKey::TokenB, &token_b);
        env.storage().instance().set(&PoolDataKey::ReserveA, &0i128);
        env.storage().instance().set(&PoolDataKey::ReserveB, &0i128);
        env.storage().instance().set(&PoolDataKey::TotalShares, &0i128);

        log!(&env, "Liquidity Pool initialized with tokens: {}, {}", token_a, token_b);
    }

    /// Deposit liquidity into the pool
    /// Performs inter-contract call to token contracts to transfer tokens
    pub fn deposit(env: Env, user: Address, amount_a: i128, amount_b: i128) {
        user.require_auth();

        if amount_a <= 0 || amount_b <= 0 {
            panic!("Amounts must be positive");
        }

        let token_a: Address = env.storage().instance().get(&PoolDataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&PoolDataKey::TokenB).unwrap();

        // Inter-contract call: Transfer tokens from user to pool
        let token_a_client = token_contract::Client::new(&env, &token_a);
        token_a_client.transfer(&user, &env.current_contract_address(), &amount_a);

        let token_b_client = token_contract::Client::new(&env, &token_b);
        token_b_client.transfer(&user, &env.current_contract_address(), &amount_b);

        // Update reserves
        let reserve_a: i128 = env.storage().instance().get(&PoolDataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = env.storage().instance().get(&PoolDataKey::ReserveB).unwrap_or(0);

        env.storage().instance().set(&PoolDataKey::ReserveA, &(reserve_a + amount_a));
        env.storage().instance().set(&PoolDataKey::ReserveB, &(reserve_b + amount_b));

        // Calculate and mint LP shares
        let total_shares: i128 = env.storage().instance().get(&PoolDataKey::TotalShares).unwrap_or(0);
        let new_shares = if total_shares == 0 {
            // First deposit: shares = sqrt(amount_a * amount_b)
            isqrt(amount_a * amount_b)
        } else {
            // Proportional: min(amount_a * total / reserve_a, amount_b * total / reserve_b)
            let share_a = amount_a * total_shares / reserve_a;
            let share_b = amount_b * total_shares / reserve_b;
            if share_a < share_b { share_a } else { share_b }
        };

        let user_shares: i128 = env.storage().persistent().get(&PoolDataKey::Shares(user.clone())).unwrap_or(0);
        env.storage().persistent().set(&PoolDataKey::Shares(user.clone()), &(user_shares + new_shares));
        env.storage().instance().set(&PoolDataKey::TotalShares, &(total_shares + new_shares));

        log!(&env, "Deposited {} token_a and {} token_b, minted {} shares", amount_a, amount_b, new_shares);
    }

    /// Swap tokens using constant product formula (x * y = k)
    /// Inter-contract call to transfer tokens
    pub fn swap(env: Env, user: Address, buy_a: bool, amount_out: i128, max_in: i128) {
        user.require_auth();

        if amount_out <= 0 {
            panic!("Output amount must be positive");
        }

        let token_a: Address = env.storage().instance().get(&PoolDataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&PoolDataKey::TokenB).unwrap();
        let reserve_a: i128 = env.storage().instance().get(&PoolDataKey::ReserveA).unwrap();
        let reserve_b: i128 = env.storage().instance().get(&PoolDataKey::ReserveB).unwrap();

        let (token_in, token_out, reserve_in, reserve_out) = if buy_a {
            (token_b.clone(), token_a.clone(), reserve_b, reserve_a)
        } else {
            (token_a.clone(), token_b.clone(), reserve_a, reserve_b)
        };

        if amount_out >= reserve_out {
            panic!("Insufficient liquidity");
        }

        // Constant product: amount_in = (reserve_in * amount_out) / (reserve_out - amount_out) + 1
        // Including 0.3% fee
        let amount_in = (reserve_in * amount_out * 1000) / ((reserve_out - amount_out) * 997) + 1;

        if amount_in > max_in {
            panic!("Slippage exceeded");
        }

        // Inter-contract calls for transfers
        let token_in_client = token_contract::Client::new(&env, &token_in);
        token_in_client.transfer(&user, &env.current_contract_address(), &amount_in);

        let token_out_client = token_contract::Client::new(&env, &token_out);
        token_out_client.transfer(&env.current_contract_address(), &user, &amount_out);

        // Update reserves
        if buy_a {
            env.storage().instance().set(&PoolDataKey::ReserveA, &(reserve_a - amount_out));
            env.storage().instance().set(&PoolDataKey::ReserveB, &(reserve_b + amount_in));
        } else {
            env.storage().instance().set(&PoolDataKey::ReserveA, &(reserve_a + amount_in));
            env.storage().instance().set(&PoolDataKey::ReserveB, &(reserve_b - amount_out));
        }

        log!(&env, "Swapped {} for {}", amount_in, amount_out);
    }

    /// Get current pool reserves
    pub fn get_reserves(env: Env) -> (i128, i128) {
        let reserve_a: i128 = env.storage().instance().get(&PoolDataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = env.storage().instance().get(&PoolDataKey::ReserveB).unwrap_or(0);
        (reserve_a, reserve_b)
    }

    /// Get user's LP share balance
    pub fn shares(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&PoolDataKey::Shares(user)).unwrap_or(0)
    }

    /// Get total LP shares
    pub fn total_shares(env: Env) -> i128 {
        env.storage().instance().get(&PoolDataKey::TotalShares).unwrap_or(0)
    }
}

/// Integer square root (Newton's method)
fn isqrt(n: i128) -> i128 {
    if n < 0 { panic!("sqrt of negative"); }
    if n == 0 { return 0; }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}
