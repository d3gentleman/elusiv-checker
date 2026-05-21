const { Connection, PublicKey } = require('@solana/web3.js');
const {
  MAX_SIGNATURES,
  SIGNATURE_PAGE_SIZE,
  PARSE_BATCH_SIZE,
  RPC_BATCH_DELAY_MS,
  HELIUS_MAX_PAGES,
  HELIUS_TX_LIMIT,
} = require('./constants');
const {
  analyzeRpcTransaction,
  analyzeHeliusTransaction,
  aggregateRows,
} = require('./analyze');
const { extractHeliusApiKey, fetchHeliusTransactions } = require('./helius');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRpcRetry(fn, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message ?? err);
      if (!/too many requests|429|503|rate limit/i.test(msg) || i === attempts - 1) {
        throw err;
      }
      await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

async function fetchAllSignatures(connection, walletPk) {
  const signatures = [];
  let before;

  while (signatures.length < MAX_SIGNATURES) {
    const page = await withRpcRetry(() =>
      connection.getSignaturesForAddress(walletPk, {
        limit: Math.min(SIGNATURE_PAGE_SIZE, MAX_SIGNATURES - signatures.length),
        before,
      }),
    );
    if (page.length === 0) break;
    signatures.push(...page);
    before = page[page.length - 1].signature;
    if (page.length < SIGNATURE_PAGE_SIZE) break;
  }

  return signatures;
}

async function fetchParsedTransactions(connection, sigs) {
  const txs = [];
  for (let i = 0; i < sigs.length; i += PARSE_BATCH_SIZE) {
    if (i > 0) await sleep(RPC_BATCH_DELAY_MS);

    const batch = sigs.slice(i, i + PARSE_BATCH_SIZE).map((s) => s.signature);
    const parsed = await withRpcRetry(() =>
      connection.getParsedTransactions(batch, {
        maxSupportedTransactionVersion: 0,
      }),
    );
    txs.push(...parsed.filter(Boolean));
  }
  return txs;
}

async function checkWalletRpc(wallet, walletPk, rpcUrl) {
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
  });

  const sigInfos = await fetchAllSignatures(connection, walletPk);
  const parsedTxs = await fetchParsedTransactions(connection, sigInfos);
  const rows = parsedTxs.map((tx) => analyzeRpcTransaction(tx, wallet));

  return aggregateRows(rows, wallet, {
    dataSource: 'rpc',
    signaturesScanned: sigInfos.length,
    notes: [
      'Using standard RPC (limited scan). For better results, add a free Helius API key.',
      'Deposits: SOL/USDC sent from this wallet to the Elusiv pool in signed Elusiv transactions.',
      'Withdrawals: SOL/USDC received from the Elusiv pool to this wallet.',
      `Scanned up to ${MAX_SIGNATURES} recent signatures on mainnet.`,
    ],
  });
}

async function checkWalletHelius(wallet, apiKey) {
  const txs = await fetchHeliusTransactions(wallet, apiKey);
  const rows = txs.map((tx) => analyzeHeliusTransaction(tx, wallet));

  return aggregateRows(rows, wallet, {
    dataSource: 'helius',
    signaturesScanned: txs.length,
    notes: [
      'Using Helius enhanced transaction API (free tier friendly).',
      'Deposits: SOL/USDC sent from this wallet to the Elusiv pool in signed Elusiv transactions.',
      'Withdrawals: SOL/USDC received from the Elusiv pool to this wallet.',
      `Fetched up to ${HELIUS_MAX_PAGES * HELIUS_TX_LIMIT} recent transactions via Helius (increase HELIUS_MAX_PAGES if your Elusiv activity is older).`,
    ],
  });
}

async function checkWallet(address, rpcUrl) {
  let walletPk;
  try {
    walletPk = new PublicKey(address.trim());
  } catch {
    const err = new Error('Invalid Solana address');
    err.status = 400;
    throw err;
  }

  const wallet = walletPk.toBase58();
  const heliusKey = extractHeliusApiKey(rpcUrl);

  if (heliusKey) {
    return checkWalletHelius(wallet, heliusKey);
  }

  try {
    return await checkWalletRpc(wallet, walletPk, rpcUrl);
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (/too many requests|429|503|rate limit/i.test(msg)) {
      const hint = new Error(
        'RPC rate limited. Add a free Helius API key: set HELIUS_API_KEY in .env (see .env.example), or use SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY',
      );
      hint.status = 503;
      throw hint;
    }
    throw err;
  }
}

module.exports = { checkWallet };
