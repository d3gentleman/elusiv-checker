import { checkWallet } from '@/lib/checker';
import { DEFAULT_RPC } from '@/lib/constants';

export const maxDuration = 60;

const RPC_URL = process.env.SOLANA_RPC_URL || DEFAULT_RPC;

export async function POST(request) {
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
    const result = await checkWallet(address, RPC_URL);
    return Response.json(result);
  } catch (err) {
    const status = err.status || 500;
    return Response.json(
      { error: err.message || 'Failed to check wallet' },
      { status },
    );
  }
}
