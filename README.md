# dev-controlled-projects

A Node.js/TypeScript project demonstrating Circle Developer-Controlled Wallets on Arc Testnet:
wallet creation, USDC/EURC transfers, and Circle Gateway's cross-chain Unified Balance.

## What was built

- **`register-entity-secret.ts`** — Generates a 32-byte entity secret locally (`node:crypto`
  `randomBytes(32)`) and registers its ciphertext with Circle via
  `registerEntitySecretCiphertext`. The entity secret itself authorizes all wallet operations for
  your account; Circle never stores it in plaintext, only the ciphertext. Registration happens
  once — the recovery file it produces (in `./recovery/`) can only be downloaded a single time.
  Refuses to run if `.env` already has a `CIRCLE_ENTITY_SECRET`, so it can't accidentally
  overwrite an existing one.

- **Two dev-controlled EOA wallets on Arc Testnet** — created via `create-wallet.ts` (wallet 1,
  its own wallet set) and `create-wallet-2.ts` (wallet 2, a separate wallet set). They form a
  send/receive pair for all the transfer and Gateway scripts below. Addresses are stored in
  `.env` as `CIRCLE_WALLET_ADDRESS` (wallet 1) and `DESTINATION_ADDRESS` (wallet 2).

- **`send-assets.ts`** — Direct wallet-to-wallet transfers on Arc Testnet. Configurable via CLI
  args: amount, direction (`1to2` or `2to1`), and token (`USDC` or `EURC`). Resolves the source
  wallet ID via `deriveWalletByAddress`, submits the transfer with `createTransaction`, polls
  `getTransaction` every 3 seconds until a terminal state, then prints the explorer link, current
  token balances, and recent outbound transaction history.

- **`retire-wallet.ts`** — Wallet decommissioning template (built, not run automatically). Circle
  has no delete/disable/archive endpoint for wallets or wallet sets, so this script sweeps all
  non-zero token balances to a specified address (leaving a small reserve on the native gas
  token) and then re-tags the wallet's `refId` with an `archived-` prefix via `updateWallet`, so
  it can be filtered out of an active wallet pool.

- **Gateway Unified Balance scripts** (`gateway-adapter.ts`, `gateway-deposit.ts`,
  `gateway-spend.ts`, `gateway-balances.ts`) — Use Circle App Kit's Unified Balance feature via
  the Circle Wallets adapter (`@circle-fin/adapter-circle-wallets`), which lets dev-controlled
  wallets (not raw private keys) act as the signer. Each script accepts a wallet selector (`1` or
  `2`, default `1`) so either wallet can deposit into or spend from its own cross-chain Unified
  Balance on Arc Testnet.

- **`memos/send-with-memo.ts`** — Attaches an on-chain memo to a USDC transfer via Arc Testnet's
  predeployed Memo contract, using `createContractExecutionTransaction` so signing still goes
  through the existing wallet/entity-secret setup (no raw private key). Builds the inner ERC-20
  `transfer` calldata and the memo's `bytes32` ID/payload locally with `viem`, then submits a
  single `memo(address,bytes,bytes32,bytes)` contract call. Same amount/direction CLI pattern as
  `send-assets.ts`, plus a memo text argument.

## Tech stack

- Node.js 22+
- TypeScript, run directly via `tsx` (no build step)
- `@circle-fin/developer-controlled-wallets` — wallet/transaction management
- `@circle-fin/app-kit` + `@circle-fin/adapter-circle-wallets` — Gateway Unified Balance
- `viem`, `@solana/kit` — transitive chain adapters required by the above

## Setup

1. Clone the repo and install dependencies:
   ```
   npm install
   ```
2. Copy the env template and fill in your Circle API key:
   ```
   cp .env.example .env
   ```
   Get an API key from [console.circle.com](https://console.circle.com) → Wallets → API Keys,
   and set `CIRCLE_API_KEY` in `.env`. Leave every other value blank — the scripts below fill
   them in.
3. Register your entity secret (one-time; refuses to run if already registered):
   ```
   npm run register-entity-secret
   ```
   This appends `CIRCLE_ENTITY_SECRET` to `.env` and writes a recovery file to `./recovery/` —
   **back that up to a secrets manager immediately**, it can only be downloaded once.
4. Create the two wallets:
   ```
   npm run create-wallet
   npm run create-wallet-2
   ```
   This appends `CIRCLE_WALLET_ADDRESS`, `CIRCLE_WALLET_BLOCKCHAIN`, and `DESTINATION_ADDRESS` to
   `.env`.
5. Fund both wallets with testnet USDC at [faucet.circle.com](https://faucet.circle.com/) before
   running any transfer or Gateway script — Arc Testnet uses USDC as its native gas token (6
   decimals), so USDC covers both value and fees.

## npm scripts

| Script | What it does | Example |
| --- | --- | --- |
| `register-entity-secret` | One-time entity secret generation + registration | `npm run register-entity-secret` |
| `create-wallet` | Creates wallet 1 (wallet set + EOA wallet) | `npm run create-wallet` |
| `create-wallet-2` | Creates wallet 2 (separate wallet set + EOA wallet) | `npm run create-wallet-2` |
| `send` | Transfers USDC/EURC between wallet 1 and wallet 2 | `npm run send -- 1 2to1 EURC` (amount, direction, token — all optional, default `0.5 1to2 USDC`) |
| `gateway-deposit` | Deposits USDC from a wallet into its Gateway Unified Balance | `npm run gateway-deposit -- 1 2` (amount, wallet `1`/`2` — both optional, default `1 1`) |
| `gateway-spend` | Spends/mints USDC from wallet 1's Unified Balance to wallet 2 | `npm run gateway-spend -- 1` (amount optional, default `1`) |
| `gateway-balances` | Prints confirmed + pending Unified Balance across all supported chains | `npm run gateway-balances -- 2` (wallet `1`/`2`, default `1`) |
| `send-with-memo` | Transfers USDC with an on-chain memo attached | `npm run send-with-memo -- 1 "invoice-2026-0001" 2to1` (amount, memo text, direction — all optional, default `1 test-memo 1to2`) |

`retire-wallet.ts` has no npm script by design (not meant to run automatically). Invoke it
directly when needed:
```
node --env-file=.env --import=tsx retire-wallet.ts <walletId> <sweepToAddress>
```

## Security notes

- **Never commit `.env`.** It holds your live `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` —
  anyone with both can sign transactions for every wallet under this entity. `.gitignore` already
  excludes `.env` and `./recovery/`.
- **The entity secret recovery file is single-download-only.** Copy it (and the entity secret
  value itself) into a proper secrets manager the moment `register-entity-secret` finishes —
  don't rely on this project folder as long-term storage.
- **Rotate, don't reuse, if either the API key or entity secret leaks.** Circle has no way to
  invalidate just the entity secret in isolation from the recovery flow, so treat both as
  equally sensitive.
