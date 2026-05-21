require('dotenv').config();

const path = require('path');
const express = require('express');
const { extractHeliusApiKey } = require('./lib/helius');
const { checkWallet } = require('./lib/checker');
const { DEFAULT_RPC } = require('./lib/constants');

const app = express();
const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.SOLANA_RPC_URL || DEFAULT_RPC;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/check', async (req, res) => {
  const address = req.body?.address?.trim();
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  try {
    const result = await checkWallet(address, RPC_URL);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to check wallet',
    });
  }
});

app.listen(PORT, () => {
  const heliusKey = extractHeliusApiKey(RPC_URL);
  console.log(`Elusiv checker running at http://localhost:${PORT}`);
  if (heliusKey) {
    console.log('Data source: Helius enhanced API (free-tier friendly)');
    console.log(`RPC (fallback): ${RPC_URL.replace(heliusKey, '***')}`);
  } else {
    console.log(`Data source: standard RPC — ${RPC_URL}`);
    console.log('Tip: set HELIUS_API_KEY in .env for reliable free-tier checks');
  }
});
