'use client';

import { useState } from 'react';

const GITHUB_URL = 'https://github.com/d3gentleman/elusiv-checker';

function formatSol(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 9 });
}

function formatUsdc(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function formatTime(unix) {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString();
}

export default function HomePage() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header>
        <h1>Elusiv wallet checker</h1>
        <p className="subtitle">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {' · Mainnet'}
        </p>
        <p className="subtitle-hint">
          If the checker fails, it&apos;s usually due to RPC rate limits. Try again in a moment, or{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            clone the repo
          </a>{' '}
          and run it with your own Helius API key or RPC endpoint.
        </p>
      </header>

      <form className="card" onSubmit={handleSubmit}>
        <label htmlFor="address">Solana address</label>
        <div className="row">
          <input
            id="address"
            name="address"
            type="text"
            placeholder="e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
            autoComplete="off"
            spellCheck={false}
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Check'}
          </button>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {result ? (
        <section className="card results">
          <h2>Results</h2>
          <p className="address-line">
            <span className="label">Wallet</span> <code>{result.address}</code>
          </p>

          <div className="stats">
            <article className="stat">
              <span className="stat-label">Interacted with Elusiv</span>
              <span className="stat-value">{result.interacted ? 'Yes' : 'No'}</span>
            </article>
            <article className="stat">
              <span className="stat-label">Total deposited (SOL)</span>
              <span className="stat-value">{formatSol(result.totalDepositedSol)}</span>
            </article>
            <article className="stat">
              <span className="stat-label">Total deposited (USDC)</span>
              <span className="stat-value">{formatUsdc(result.totalDepositedUsdc ?? 0)}</span>
            </article>
            <article className="stat">
              <span className="stat-label">Total withdrawn (SOL)</span>
              <span className="stat-value">{formatSol(result.totalWithdrawnSol)}</span>
            </article>
            <article className="stat">
              <span className="stat-label">Total withdrawn (USDC)</span>
              <span className="stat-value">{formatUsdc(result.totalWithdrawnUsdc ?? 0)}</span>
            </article>
            <article className="stat">
              <span className="stat-label">Deposit count</span>
              <span className="stat-value">{result.depositCount}</span>
            </article>
            <article className="stat">
              <span className="stat-label">Withdrawal count</span>
              <span className="stat-value">{result.withdrawCount}</span>
            </article>
            <article className="stat">
              <span className="stat-label">Elusiv txs (signed)</span>
              <span className="stat-value">{result.elusivTxCount}</span>
            </article>
            <article className="stat">
              <span className="stat-label">Signatures scanned</span>
              <span className="stat-value">
                {result.signaturesScanned} ({result.dataSource ?? 'rpc'})
              </span>
            </article>
            <article className="stat wide">
              <span className="stat-label">First / last activity</span>
              <span className="stat-value">
                {formatTime(result.firstInteractionAt)} → {formatTime(result.lastInteractionAt)}
              </span>
            </article>
          </div>

          <h3>Recent pool movements</h3>
          <ul className="recent-list">
            {result.recentTransactions.length === 0 ? (
              <li>No pool transfers found in scanned history.</li>
            ) : (
              result.recentTransactions.map((tx) => {
                const parts = [];
                if (tx.depositSol > 0) parts.push(`deposit ${formatSol(tx.depositSol)} SOL`);
                if (tx.depositUsdc > 0) parts.push(`deposit ${formatUsdc(tx.depositUsdc)} USDC`);
                if (tx.withdrawSol > 0) parts.push(`withdraw ${formatSol(tx.withdrawSol)} SOL`);
                if (tx.withdrawUsdc > 0) parts.push(`withdraw ${formatUsdc(tx.withdrawUsdc)} USDC`);
                const typeLabel = tx.type ? ` · ${tx.type}` : '';
                return (
                  <li key={tx.signature}>
                    <a
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tx.signature.slice(0, 16)}…
                    </a>
                    {typeLabel} · {parts.join(' · ') || 'Elusiv tx'} · {formatTime(tx.blockTime)}
                  </li>
                );
              })
            )}
          </ul>

          <ul className="notes">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
