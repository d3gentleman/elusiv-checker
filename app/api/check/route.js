import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function loadChecker() {
  const { checkWallet } = require('../../../lib/checker');
  const { DEFAULT_RPC } = require('../../../lib/constants');
  const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_RPC;
  return { checkWallet, rpcUrl };
}

export async function POST(request) {
  let checkWallet;
  let rpcUrl;
  try {
    ({ checkWallet, rpcUrl } = loadChecker());
  } catch (err) {
    console.error('Failed to load checker:', err);
    return Response.json(
      { error: `Server module error: ${err.message}` },
      { status: 500 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const address = body?.address?.trim();
  if (!address) {
    return Response.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    const result = await checkWallet(address, rpcUrl);
    return Response.json(result);
  } catch (err) {
    console.error('checkWallet failed:', err);
    const status = err.status || 500;
    return Response.json(
      { error: err.message || 'Failed to check wallet' },
      { status },
    );
  }
}
