const form = document.getElementById('check-form');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');
const submitBtn = document.getElementById('submit-btn');

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

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const address = document.getElementById('address').value.trim();

  errorEl.hidden = true;
  resultsEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Checking…';

  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    setText('out-address', data.address);
    setText('out-interacted', data.interacted ? 'Yes' : 'No');
    setText('out-deposited', formatSol(data.totalDepositedSol));
    setText('out-deposited-usdc', formatUsdc(data.totalDepositedUsdc ?? 0));
    setText('out-withdrawn', formatSol(data.totalWithdrawnSol));
    setText('out-withdrawn-usdc', formatUsdc(data.totalWithdrawnUsdc ?? 0));
    setText('out-deposit-count', String(data.depositCount));
    setText('out-withdraw-count', String(data.withdrawCount));
    setText('out-elusiv-txs', String(data.elusivTxCount));
    setText('out-scanned', `${data.signaturesScanned} (${data.dataSource ?? 'rpc'})`);
    setText(
      'out-dates',
      `${formatTime(data.firstInteractionAt)} → ${formatTime(data.lastInteractionAt)}`,
    );

    const recentEl = document.getElementById('out-recent');
    recentEl.innerHTML = '';
    if (data.recentTransactions.length === 0) {
      recentEl.innerHTML = '<li>No pool transfers found in scanned history.</li>';
    } else {
      for (const tx of data.recentTransactions) {
        const li = document.createElement('li');
        const parts = [];
        if (tx.depositSol > 0) parts.push(`deposit ${formatSol(tx.depositSol)} SOL`);
        if (tx.depositUsdc > 0) parts.push(`deposit ${formatUsdc(tx.depositUsdc)} USDC`);
        if (tx.withdrawSol > 0) parts.push(`withdraw ${formatSol(tx.withdrawSol)} SOL`);
        if (tx.withdrawUsdc > 0) parts.push(`withdraw ${formatUsdc(tx.withdrawUsdc)} USDC`);
        const typeLabel = tx.type ? ` · ${tx.type}` : '';
        li.innerHTML = `<a href="https://solscan.io/tx/${tx.signature}" target="_blank" rel="noopener">${tx.signature.slice(0, 16)}…</a>${typeLabel} · ${parts.join(' · ') || 'Elusiv tx'} · ${formatTime(tx.blockTime)}`;
        recentEl.appendChild(li);
      }
    }

    const notesEl = document.getElementById('out-notes');
    notesEl.innerHTML = '';
    for (const note of data.notes) {
      const li = document.createElement('li');
      li.textContent = note;
      notesEl.appendChild(li);
    }

    resultsEl.hidden = false;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Check';
  }
});
