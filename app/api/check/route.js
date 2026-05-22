export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  let checkWallet;
  let DEFAULT_RPC;
  try {
    ({ checkWallet } = await import('@/lib/checker'));
    ({ DEFAULT_RPC } = await import('@/lib/constants'));
  } catch (err) {
    console.error('Failed to load checker modules:', err);
    return Response.json(
      { error: 'Server failed to load checker modules' },
      { status: 500 },
    );
  }

  const RPC_URL = process.env.SOLANA_RPC_URL || DEFAULT_RPC;

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
    console.error('checkWallet failed:', err);
    const status = err.status || 500;
    return Response.json(
      { error: err.message || 'Failed to check wallet' },
      { status },
    );
  }
}
