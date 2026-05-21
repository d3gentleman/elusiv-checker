# Elusiv on-chain program IDs

Source: `@elusiv/sdk@0.1.29` (`getElusivProgramId`, `getElusivPoolAddress`). These match the addresses historically shipped in the Elusiv repo `Id.toml` (linked at compile time; upstream repos are no longer publicly cloneable).

## Mainnet (`mainnet-beta`)

| Role | Address |
|------|---------|
| **Elusiv program** (use for wallet checks) | `4CgyHKuP6yi1vbmcdsArngEKcETR4nZupqYEMk2hEoQd` |
| Elusiv pool PDA (`Pool` seed) | `HszJz1zLnYpK5e8TvsRDPSDrxc19qFuhWrFQG6xY2aMX` |
| Default warden RPC (off-chain relay, not a program) | `https://warden-mainnet.elusiv.io` |

## Devnet

| Role | Address |
|------|---------|
| Elusiv program | `B5TTFPKCd2Rkw3vAJigLeRCDGK673vfAWefmrrZKou9V` |
| Elusiv pool PDA | `ETqAsr86hGqLHoQzjRXvo4XKtCJukyx9JMKoNu4RhsVm` |
| Default warden RPC | `https://warden-devnet.elusiv.io` |

## Checker usage

For your definition (“wallet is a **signer** and tx **invokes** the Elusiv program”):

- Filter mainnet transactions where `4CgyHKuP6yi1vbmcdsArngEKcETR4nZupqYEMk2hEoQd` appears in `message.accountKeys` (or inner instructions) **and** the wallet is in the signatures list with `signer: true`.
- You do **not** need the pool PDA or warden URL for that rule; the pool address is only useful for analytics (deposits/withdrawals targeting the pool).

## Warden Network program

The core repo also documents a separate **Elusiv-Warden-Network** program. It is **not** exported by `getElusivProgramId()` in the public SDK. Private sends may be relayed via warden **wallets** (variable pubkeys), not necessarily that program. For v1, stick to the main Elusiv program ID above.

## How to re-derive

```bash
npm pack @elusiv/sdk
tar -xzf elusiv-sdk-*.tgz
cd package && npm install @solana/web3.js --no-save
node -e "const {getElusivProgramId,getElusivPoolAddress}=require('./index.cjs');
console.log(getElusivProgramId('mainnet-beta').toBase58());
console.log(getElusivPoolAddress('mainnet-beta').toBase58());"
```

Explorer: [Elusiv program on Solscan](https://solscan.io/account/4CgyHKuP6yi1vbmcdsArngEKcETR4nZupqYEMk2hEoQd)
