/** @see PROGRAM_IDS.md — from @elusiv/sdk@0.1.29 */
const ELUSIV_PROGRAM_ID = '4CgyHKuP6yi1vbmcdsArngEKcETR4nZupqYEMk2hEoQd';
const ELUSIV_POOL_ADDRESS = 'HszJz1zLnYpK5e8TvsRDPSDrxc19qFuhWrFQG6xY2aMX';

/** Mainnet USDC — from @elusiv/sdk TokenInfo */
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DECIMALS = 6;
const MIN_USDC_AMOUNT = 0.0001;

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

/** Standard RPC path — kept low for public / free RPC limits */
const MAX_SIGNATURES = 80;
const SIGNATURE_PAGE_SIZE = 80;
const PARSE_BATCH_SIZE = 8;
const RPC_BATCH_DELAY_MS = 700;

/** Helius enhanced API (recommended on free tier) */
const HELIUS_TX_LIMIT = 100;
/** Elusiv was most active ~2023–2024; active wallets may need deeper history */
const HELIUS_MAX_PAGES = Number(process.env.HELIUS_MAX_PAGES) || 10;
const HELIUS_PAGE_DELAY_MS = 550;

module.exports = {
  ELUSIV_PROGRAM_ID,
  ELUSIV_POOL_ADDRESS,
  USDC_MINT,
  USDC_DECIMALS,
  MIN_USDC_AMOUNT,
  DEFAULT_RPC,
  MAX_SIGNATURES,
  SIGNATURE_PAGE_SIZE,
  PARSE_BATCH_SIZE,
  RPC_BATCH_DELAY_MS,
  HELIUS_TX_LIMIT,
  HELIUS_MAX_PAGES,
  HELIUS_PAGE_DELAY_MS,
};
