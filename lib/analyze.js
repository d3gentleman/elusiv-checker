const {
  ELUSIV_PROGRAM_ID,
  ELUSIV_POOL_ADDRESS,
  USDC_MINT,
  USDC_DECIMALS,
  MIN_USDC_AMOUNT,
} = require('./constants');

/** Ignore rent/fees; real pool movements are usually larger */
const MIN_BALANCE_DELTA_LAMPORTS = 50_000;

function pubkeyStr(key) {
  if (typeof key === 'string') return key;
  if (key?.pubkey) return key.pubkey.toBase58();
  return key.toBase58();
}

function txInvolvesElusivRpc(tx) {
  const keys = tx.transaction.message.accountKeys.map(pubkeyStr);
  if (keys.includes(ELUSIV_PROGRAM_ID)) return true;

  for (const ix of tx.transaction.message.instructions) {
    if (ix.programId === ELUSIV_PROGRAM_ID) return true;
    if (
      typeof ix.programIdIndex === 'number' &&
      keys[ix.programIdIndex] === ELUSIV_PROGRAM_ID
    ) {
      return true;
    }
  }

  for (const group of tx.meta?.innerInstructions ?? []) {
    for (const ix of group.instructions) {
      if (ix.programId === ELUSIV_PROGRAM_ID) return true;
      if (
        typeof ix.programIdIndex === 'number' &&
        keys[ix.programIdIndex] === ELUSIV_PROGRAM_ID
      ) {
        return true;
      }
    }
  }
  return false;
}

function heliusInvolvesElusiv(tx) {
  if (JSON.stringify(tx).includes(ELUSIV_PROGRAM_ID)) return true;

  const checkIx = (ix) => {
    if (ix?.programId === ELUSIV_PROGRAM_ID) return true;
    for (const inner of ix?.innerInstructions ?? []) {
      if (inner?.programId === ELUSIV_PROGRAM_ID) return true;
    }
    return false;
  };

  for (const ix of tx.instructions ?? []) {
    if (checkIx(ix)) return true;
  }
  return false;
}

function poolReferencedInHelius(tx) {
  if (JSON.stringify(tx).includes(ELUSIV_POOL_ADDRESS)) return true;
  for (const ix of tx.instructions ?? []) {
    if (ix.accounts?.includes(ELUSIV_POOL_ADDRESS)) return true;
    for (const inner of ix.innerInstructions ?? []) {
      if (inner.accounts?.includes(ELUSIV_POOL_ADDRESS)) return true;
    }
  }
  return false;
}

function walletInvolvedHelius(tx, wallet) {
  if (tx.feePayer === wallet) return true;
  if ((tx.accountData ?? []).some((a) => a.account === wallet)) return true;

  for (const ix of tx.instructions ?? []) {
    if (ix.accounts?.includes(wallet)) return true;
    for (const inner of ix.innerInstructions ?? []) {
      if (inner.accounts?.includes(wallet)) return true;
    }
  }

  for (const nt of tx.nativeTransfers ?? []) {
    if (nt.fromUserAccount === wallet || nt.toUserAccount === wallet) return true;
  }
  for (const tt of tx.tokenTransfers ?? []) {
    if (tt.fromUserAccount === wallet || tt.toUserAccount === wallet) return true;
  }
  return false;
}

function walletInvolvedRpc(tx, wallet) {
  const keys = tx.transaction.message.accountKeys.map(pubkeyStr);
  if (keys.includes(wallet)) return true;
  return collectRpcTransfers(tx).some(
    (t) => t.source === wallet || t.destination === wallet,
  );
}

function getRpcWalletBalanceDelta(tx, wallet) {
  const keys = tx.transaction.message.accountKeys.map(pubkeyStr);
  const idx = keys.indexOf(wallet);
  if (idx < 0) return 0;
  const pre = tx.meta?.preBalances?.[idx] ?? 0;
  const post = tx.meta?.postBalances?.[idx] ?? 0;
  return post - pre;
}

function getHeliusWalletBalanceDelta(tx, wallet) {
  const row = (tx.accountData ?? []).find((a) => a.account === wallet);
  return row?.nativeBalanceChange ?? 0;
}

function getHeliusPoolBalanceDelta(tx) {
  const row = (tx.accountData ?? []).find((a) => a.account === ELUSIV_POOL_ADDRESS);
  return row?.nativeBalanceChange ?? 0;
}

function getRpcPoolBalanceDelta(tx) {
  const keys = tx.transaction.message.accountKeys.map(pubkeyStr);
  const idx = keys.indexOf(ELUSIV_POOL_ADDRESS);
  if (idx < 0) return 0;
  const pre = tx.meta?.preBalances?.[idx] ?? 0;
  const post = tx.meta?.postBalances?.[idx] ?? 0;
  return post - pre;
}

/** Fee payer, Elusiv sender account, or any outbound SOL transfer in this tx. */
function canAuthorizeDeposit(tx, wallet, isSigner, transfers = []) {
  if (isSigner) return true;
  if (transfers.some((t) => t.source === wallet)) return true;

  const keys = tx.accountKeys ?? [];
  for (const ix of tx.instructions ?? []) {
    let programId = ix.programId;
    if (!programId && typeof ix.programIdIndex === 'number') {
      programId = keys[ix.programIdIndex];
    }
    if (programId === ELUSIV_PROGRAM_ID && ix.accounts?.includes(wallet)) return true;
  }
  return false;
}

/** Helius tokenAmount is already human-readable (e.g. 9.5 USDC). */
function sumUsdcFromHelius(tx, wallet) {
  let depositUsdc = 0;
  let withdrawUsdc = 0;

  for (const tt of tx.tokenTransfers ?? []) {
    if (tt.mint !== USDC_MINT) continue;
    const amount = Number(tt.tokenAmount ?? 0);
    if (amount < MIN_USDC_AMOUNT) continue;

    if (tt.fromUserAccount === wallet) depositUsdc += amount;
    if (tt.toUserAccount === wallet) withdrawUsdc += amount;
  }

  return { depositUsdc, withdrawUsdc };
}

function uiAmountFromTokenBalance(tb) {
  const ui = tb.uiTokenAmount;
  if (!ui) return 0;
  if (ui.uiAmount != null) return Number(ui.uiAmount);
  const raw = Number(ui.amount ?? 0);
  const dec = ui.decimals ?? USDC_DECIMALS;
  return raw / 10 ** dec;
}

function sumUsdcFromRpc(tx, wallet) {
  const preByIndex = new Map();
  const postByIndex = new Map();

  for (const tb of tx.meta?.preTokenBalances ?? []) {
    if (tb.mint === USDC_MINT && tb.owner === wallet) {
      preByIndex.set(tb.accountIndex, uiAmountFromTokenBalance(tb));
    }
  }
  for (const tb of tx.meta?.postTokenBalances ?? []) {
    if (tb.mint === USDC_MINT && tb.owner === wallet) {
      postByIndex.set(tb.accountIndex, uiAmountFromTokenBalance(tb));
    }
  }

  let depositUsdc = 0;
  let withdrawUsdc = 0;
  const indices = new Set([...preByIndex.keys(), ...postByIndex.keys()]);

  for (const idx of indices) {
    const delta = (postByIndex.get(idx) ?? 0) - (preByIndex.get(idx) ?? 0);
    if (delta <= -MIN_USDC_AMOUNT) depositUsdc += Math.abs(delta);
    if (delta >= MIN_USDC_AMOUNT) withdrawUsdc += delta;
  }

  return { depositUsdc, withdrawUsdc };
}

function collectRpcTransfers(tx) {
  const transfers = [];
  const addParsed = (ix) => {
    if (!ix?.parsed) return;
    const { type, info } = ix.parsed;
    if (type === 'transfer' && info?.source && info?.destination) {
      transfers.push({
        source: info.source,
        destination: info.destination,
        lamports: Number(info.lamports ?? 0),
      });
    }
  };

  for (const ix of tx.transaction.message.instructions) addParsed(ix);
  for (const group of tx.meta?.innerInstructions ?? []) {
    for (const ix of group.instructions) addParsed(ix);
  }
  return transfers;
}

function collectHeliusTransfers(tx) {
  const transfers = [];
  for (const nt of tx.nativeTransfers ?? []) {
    if (!nt.fromUserAccount || !nt.toUserAccount) continue;
    transfers.push({
      source: nt.fromUserAccount,
      destination: nt.toUserAccount,
      lamports: Number(nt.amount ?? 0),
    });
  }
  return transfers;
}

function classifyMovement({
  transfers,
  wallet,
  walletDelta,
  poolDelta,
  poolReferenced,
  isSigner,
  tx,
  depositUsdc = 0,
  withdrawUsdc = 0,
}) {
  let depositLamports = 0;
  let withdrawLamports = 0;
  const canDeposit = canAuthorizeDeposit(tx, wallet, isSigner, transfers);

  for (const t of transfers) {
    if (t.source === wallet && t.destination === ELUSIV_POOL_ADDRESS) {
      depositLamports += t.lamports;
    }
    if (t.source === ELUSIV_POOL_ADDRESS && t.destination === wallet) {
      withdrawLamports += t.lamports;
    }
  }

  // Top-ups usually show as pool inflow; fee payer may only show -5000 lamports (tx fee)
  if (depositLamports === 0 && poolDelta >= MIN_BALANCE_DELTA_LAMPORTS && canDeposit && poolReferenced) {
    depositLamports = poolDelta;
  }

  if (depositLamports === 0 && walletDelta <= -MIN_BALANCE_DELTA_LAMPORTS && canDeposit) {
    depositLamports = Math.abs(walletDelta);
  }

  if (depositLamports === 0 && canDeposit && poolDelta > 0) {
    const sent = transfers
      .filter((t) => t.source === wallet)
      .reduce((sum, t) => sum + t.lamports, 0);
    if (sent >= MIN_BALANCE_DELTA_LAMPORTS) {
      depositLamports = Math.min(sent, poolDelta);
    }
  }

  // Withdrawals: pool outflow is the reliable signal
  if (poolDelta <= -MIN_BALANCE_DELTA_LAMPORTS && poolReferenced) {
    withdrawLamports = Math.abs(poolDelta);
  } else if (withdrawLamports === 0 && walletDelta >= MIN_BALANCE_DELTA_LAMPORTS && poolReferenced) {
    withdrawLamports = walletDelta;
  }

  const usdcDeposit = depositUsdc >= MIN_USDC_AMOUNT && canDeposit ? depositUsdc : 0;
  const usdcWithdraw = withdrawUsdc >= MIN_USDC_AMOUNT ? withdrawUsdc : 0;

  const isDeposit =
    canDeposit && (depositLamports > 0 || usdcDeposit > 0);
  const isWithdraw = withdrawLamports > 0 || usdcWithdraw > 0;

  return {
    depositLamports: isDeposit ? depositLamports : 0,
    withdrawLamports: isWithdraw ? withdrawLamports : 0,
    depositUsdc: isDeposit ? usdcDeposit : 0,
    withdrawUsdc: isWithdraw ? usdcWithdraw : 0,
    isDeposit,
    isWithdraw,
  };
}

function analyzeRpcTransaction(tx, wallet) {
  if (!tx?.meta || tx.meta.err) return null;
  if (!txInvolvesElusivRpc(tx)) return null;
  if (!walletInvolvedRpc(tx, wallet)) return null;

  const isSigner = tx.transaction.message.accountKeys.some(
    (acc) => pubkeyStr(acc) === wallet && acc.signer === true,
  );
  const walletDelta = getRpcWalletBalanceDelta(tx, wallet);
  const poolDelta = getRpcPoolBalanceDelta(tx);
  const poolReferenced = tx.transaction.message.accountKeys
    .map(pubkeyStr)
    .includes(ELUSIV_POOL_ADDRESS);

  const usdc = sumUsdcFromRpc(tx, wallet);

  const { depositLamports, withdrawLamports, depositUsdc, withdrawUsdc, isDeposit, isWithdraw } =
    classifyMovement({
      transfers: collectRpcTransfers(tx),
      wallet,
      walletDelta,
      poolDelta,
      poolReferenced,
      isSigner,
      tx: {
        instructions: tx.transaction.message.instructions,
        accountKeys: tx.transaction.message.accountKeys.map(pubkeyStr),
      },
      depositUsdc: usdc.depositUsdc,
      withdrawUsdc: usdc.withdrawUsdc,
    });

  return {
    signature: tx.transaction.signatures[0],
    blockTime: tx.blockTime ?? null,
    isSigner,
    depositLamports,
    withdrawLamports,
    depositUsdc,
    withdrawUsdc,
    elusivInteraction: true,
    interactionType: isDeposit ? 'deposit' : isWithdraw ? 'withdraw' : isSigner ? 'signed' : 'referenced',
  };
}

function analyzeHeliusTransaction(tx, wallet) {
  if (tx.transactionError) return null;
  if (!heliusInvolvesElusiv(tx)) return null;
  if (!walletInvolvedHelius(tx, wallet)) return null;

  const isSigner = tx.feePayer === wallet;
  const walletDelta = getHeliusWalletBalanceDelta(tx, wallet);
  const poolDelta = getHeliusPoolBalanceDelta(tx);
  const poolReferenced = poolReferencedInHelius(tx);

  const usdc = sumUsdcFromHelius(tx, wallet);

  const { depositLamports, withdrawLamports, depositUsdc, withdrawUsdc, isDeposit, isWithdraw } =
    classifyMovement({
      transfers: collectHeliusTransfers(tx),
      wallet,
      walletDelta,
      poolDelta,
      poolReferenced,
      isSigner,
      tx,
      depositUsdc: usdc.depositUsdc,
      withdrawUsdc: usdc.withdrawUsdc,
    });

  return {
    signature: tx.signature,
    blockTime: tx.timestamp ?? null,
    isSigner,
    depositLamports,
    withdrawLamports,
    depositUsdc,
    withdrawUsdc,
    elusivInteraction: true,
    interactionType: isDeposit ? 'deposit' : isWithdraw ? 'withdraw' : isSigner ? 'signed' : 'referenced',
  };
}

function aggregateRows(rows, wallet, meta) {
  let totalDepositedLamports = 0;
  let totalWithdrawnLamports = 0;
  let totalDepositedUsdc = 0;
  let totalWithdrawnUsdc = 0;
  let depositCount = 0;
  let withdrawCount = 0;
  let elusivTxCount = 0;
  let firstInteractionAt = null;
  let lastInteractionAt = null;
  const recent = [];

  for (const row of rows) {
    if (!row) continue;
    if (row.elusivInteraction) elusivTxCount += 1;

    const hasDeposit = row.depositLamports > 0 || row.depositUsdc > 0;
    const hasWithdraw = row.withdrawLamports > 0 || row.withdrawUsdc > 0;

    if (hasDeposit) {
      totalDepositedLamports += row.depositLamports;
      totalDepositedUsdc += row.depositUsdc ?? 0;
      depositCount += 1;
    }
    if (hasWithdraw) {
      totalWithdrawnLamports += row.withdrawLamports;
      totalWithdrawnUsdc += row.withdrawUsdc ?? 0;
      withdrawCount += 1;
    }

    if (row.blockTime) {
      if (!firstInteractionAt || row.blockTime < firstInteractionAt) firstInteractionAt = row.blockTime;
      if (!lastInteractionAt || row.blockTime > lastInteractionAt) lastInteractionAt = row.blockTime;
    }

    if (hasDeposit || hasWithdraw || row.elusivInteraction) {
      recent.push({
        signature: row.signature,
        blockTime: row.blockTime,
        depositSol: row.depositLamports / 1e9,
        depositUsdc: row.depositUsdc ?? 0,
        withdrawSol: row.withdrawLamports / 1e9,
        withdrawUsdc: row.withdrawUsdc ?? 0,
        type: row.interactionType,
      });
    }
  }

  recent.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));

  return {
    address: wallet,
    interacted: elusivTxCount > 0,
    ...meta,
    elusivTxCount,
    depositCount,
    withdrawCount,
    totalDepositedSol: totalDepositedLamports / 1e9,
    totalWithdrawnSol: totalWithdrawnLamports / 1e9,
    totalDepositedUsdc,
    totalWithdrawnUsdc,
    firstInteractionAt,
    lastInteractionAt,
    recentTransactions: recent.slice(0, 10),
    notes: [
      ...(meta.notes ?? []),
      'Deposits are detected when the Elusiv pool receives SOL/USDC (or you send tokens), not only when your wallet balance drops.',
      'Private Elusiv sends relayed by wardens may not list your wallet on-chain — only top-ups/withdrawals and signed pool txs are visible here.',
      'If deposits are missing, your top-up may be older than the scanned history — set HELIUS_MAX_PAGES=20 in .env and restart.',
    ],
  };
}

module.exports = {
  analyzeRpcTransaction,
  analyzeHeliusTransaction,
  aggregateRows,
};
