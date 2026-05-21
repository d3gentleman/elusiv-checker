const {
  HELIUS_TX_LIMIT,
  HELIUS_MAX_PAGES,
  HELIUS_PAGE_DELAY_MS,
} = require('./constants');

function extractHeliusApiKey(rpcUrl) {
  if (process.env.HELIUS_API_KEY?.trim()) {
    return process.env.HELIUS_API_KEY.trim();
  }
  if (!rpcUrl) return null;
  try {
    const url = new URL(rpcUrl);
    return url.searchParams.get('api-key');
  } catch {
    return null;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helius enhanced history: up to 100 txs per request (free tier friendly).
 * @see https://www.helius.dev/docs/api-reference/enhanced-transactions/gettransactionsbyaddress
 */
async function fetchHeliusTransactions(address, apiKey) {
  const txs = [];
  let before;

  for (let page = 0; page < HELIUS_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      'api-key': apiKey,
      limit: String(HELIUS_TX_LIMIT),
    });
    if (before) params.set('before-signature', before);

    const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(
        res.status === 401
          ? 'Invalid Helius API key. Check HELIUS_API_KEY in .env'
          : `Helius API error (${res.status}): ${body.slice(0, 200)}`,
      );
      err.status = res.status === 401 ? 401 : 502;
      throw err;
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    txs.push(...batch);
    before = batch[batch.length - 1].signature;

    if (batch.length < HELIUS_TX_LIMIT) break;
    if (page < HELIUS_MAX_PAGES - 1) await sleep(HELIUS_PAGE_DELAY_MS);
  }

  return txs;
}

module.exports = { extractHeliusApiKey, fetchHeliusTransactions };
