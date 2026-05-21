# Elusiv wallet checker

Simple web UI to check whether a Solana wallet deposited to or withdrew from the [Elusiv](https://app.elusiv.io/) pool on mainnet.

## Quick start (free tier — recommended)

1. Create a **free** API key at [Helius Dashboard](https://dashboard.helius.dev) (no credit card on free plan).
2. Copy `.env.example` to `.env` and set your key:

```bash
cp .env.example .env
# Edit .env: HELIUS_API_KEY=your_key_here
```

3. Run:

```bash
npm install
npm start
```

Open http://localhost:3000

The app uses Helius **enhanced transaction history** (2–3 HTTP calls per check), which stays within free-tier limits. Your key is read from `HELIUS_API_KEY`, or from the `api-key` query param if you use `SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...`.

## Without Helius

The public Solana RPC (`api.mainnet-beta.solana.com`) rate-limits heavily. The app scans only **80** recent signatures in small batches, but you may still see 429 errors. **Use a Helius free key for personal use.**

## What it reports

- **Total deposited / withdrawn (SOL and USDC)** — transfers between the wallet and the Elusiv pool
- **Deposit / withdrawal counts**
- **Interacted** — signed a transaction that invoked the Elusiv program
- **Recent pool movements** — last 10 matching txs with Solscan links

See `PROGRAM_IDS.md` for on-chain addresses.

## Limits

- Mainnet only
- SOL and USDC only (other Elusiv tokens not summed yet)
- Helius path: up to 300 recent transactions (3 × 100)
- RPC fallback: up to 80 recent signatures

## GitHub

This project keeps secrets out of git (`.env` is ignored; use `.env.example` as a template).

To create the remote repo and push (one-time, after [GitHub CLI](https://cli.github.com/) login):

```powershell
gh auth login
.\scripts\publish-github.ps1
```
