import { STRATEGIES } from './strategies.js';
import { featureVector } from './features.js';
import { WARMUP } from './indicators.js';
import { costFor, INSTRUMENTS } from './instruments.js';
import { wilsonLower } from './model.js';

/** A trade not resolved within a day is closed at market — dead money is risk with no reward. */
export const MAX_BARS = 24;

/**
 * Walks a trade forward bar by bar until target, stop or timeout.
 *
 * Conservative by construction: when one bar spans both stop and
 * target, the stop is assumed to have hit first (hourly bars cannot say
 * which came first, and assuming the target is how backtests lie). A
 * gap through the stop fills at the open, not at the stop.
 */
export function simulate(bars, startIdx, { dir, entry, stop, tp, beAt }, cost, maxBars = MAX_BARS) {
  const risk = dir * (entry - stop);
  const last = Math.min(startIdx + maxBars - 1, bars.length - 1);
  let stopNow = stop, beArmed = false;
  for (let j = startIdx; j <= last; j++) {
    const b = bars[j];
    const hitSL = dir > 0 ? b.l <= stopNow : b.h >= stopNow;
    const hitTP = dir > 0 ? b.h >= tp : b.l <= tp;
    if (hitSL) {
      const gapped = j > startIdx && (dir > 0 ? b.o < stopNow : b.o > stopNow);
      const exit = gapped ? b.o : stopNow;
      return { outcome: beArmed ? 'BE' : 'SL', win: 0, exitIdx: j, exit, R: (dir * (exit - entry) - cost) / risk };
    }
    if (hitTP) return { outcome: 'TP', win: 1, exitIdx: j, exit: tp, R: (dir * (tp - entry) - cost) / risk };
    // Breakeven arms only from the NEXT bar: within this bar we cannot know
    // whether the move to the trigger came before or after a dip
    if (beAt && !beArmed && (dir > 0 ? b.h >= entry + beAt * risk : b.l <= entry - beAt * risk)) {
      beArmed = true;
      stopNow = entry + dir * cost; // covers the spread, so a scratch is a true scratch
    }
  }
  if (startIdx + maxBars - 1 > bars.length - 1) return null; // ran out of data — unresolved, not a loss
  const exit = bars[last].c;
  return { outcome: 'TIME', win: 0, exitIdx: last, exit, R: (dir * (exit - entry) - cost) / risk };
}

/** Turns a detected setup into concrete levels. Shared with the live scanner. */
export function buildTrade(setup, entry, atrNow, tpMult, beFrac = null) {
  const risk = setup.dir * (entry - setup.stop);
  // Reject stops that are noise-thin or so wide the target becomes unreachable in a day
  if (!(risk >= 0.4 * atrNow && risk <= 3.5 * atrNow)) return null;
  return { ...setup, entry, risk, tp: entry + setup.dir * tpMult * risk, beAt: beFrac ? beFrac * tpMult : null };
}

/**
 * Every setup any strategy flagged in the history, with its features and
 * its true outcome for a given reward multiple. Entry is the NEXT bar's
 * open — the first price actually tradable after the signal bar closes.
 */
export function generateCandidates(bars, x, key, tpMult, beFrac = null) {
  const inst = INSTRUMENTS[key];
  const out = [];
  for (let i = WARMUP; i < bars.length - 1; i++) {
    for (const s of STRATEGIES) {
      const raw = s.detect(bars, x, i, key);
      if (!raw) continue;
      const setup = { ...raw, strategy: s.id };
      const trade = buildTrade(setup, bars[i + 1].o, x.atr[i], tpMult, beFrac);
      if (!trade) continue;
      const res = simulate(bars, i + 1, trade, costFor(inst, trade.entry));
      if (!res) continue;
      out.push({ i, t: bars[i].t, ...trade, ...res, x: featureVector(bars, x, i, setup, trade.entry) });
    }
  }
  return out;
}

/**
 * Replays the selected trades the way a single account would take them:
 * one position per instrument at a time, best-probability setup wins a
 * tie. This is what the reported stats are computed on — not the raw
 * candidate pool, which double-counts overlapping trades.
 */
export function takeSequential(cands) {
  const byBar = new Map();
  for (const c of cands) {
    const cur = byBar.get(c.i);
    if (!cur || c.p > cur.p) byBar.set(c.i, c);
  }
  const taken = [];
  let busyUntil = -1;
  for (const c of [...byBar.values()].sort((a, b) => a.i - b.i)) {
    if (c.i < busyUntil) continue;
    taken.push(c);
    busyUntil = c.exitIdx;
  }
  return taken;
}

export function stats(trades) {
  const n = trades.length;
  const wins = trades.reduce((s, t) => s + t.win, 0);
  const fullLosses = trades.filter(t => t.outcome === 'SL').length;
  const Rs = trades.map(t => t.R);
  const sumR = Rs.reduce((s, r) => s + r, 0);
  const gross = Rs.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const loss = -Rs.filter(r => r < 0).reduce((s, r) => s + r, 0);
  let peak = 0, eq = 0, maxDD = 0;
  for (const r of Rs) { eq += r; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, peak - eq); }
  return {
    n, wins,
    winRate: n ? wins / n : 0,
    winRateLow95: wilsonLower(wins, n),
    // Breakeven scratches and timeouts are neither wins nor full stop-outs
    fullLossRate: n ? fullLosses / n : 0,
    expectancyR: n ? sumR / n : 0,
    totalR: sumR,
    profitFactor: loss ? gross / loss : (gross ? Infinity : 0),
    maxDrawdownR: maxDD
  };
}

/**
 * "Flipping" odds: bootstrap the trade results under fixed-fractional
 * compounding and count how often the account doubles before it halves.
 * Answers the question the user actually cares about with the trades the
 * model actually produced, rather than with a headline win rate.
 */
export function monteCarlo(Rs, { riskPct = 2, paths = 4000, maxTrades = 400 } = {}) {
  if (Rs.length < 8) return null;
  let doubled = 0, halved = 0;
  const toDouble = [];
  for (let p = 0; p < paths; p++) {
    let eq = 1;
    for (let k = 1; k <= maxTrades; k++) {
      eq *= 1 + (riskPct / 100) * Rs[Math.floor(Math.random() * Rs.length)];
      if (eq >= 2) { doubled++; toDouble.push(k); break; }
      if (eq <= 0.5) { halved++; break; }
    }
  }
  toDouble.sort((a, b) => a - b);
  return {
    riskPct,
    pDoubleFirst: doubled / paths,
    pHalveFirst: halved / paths,
    medianTradesToDouble: toDouble.length ? toDouble[Math.floor(toDouble.length / 2)] : null
  };
}
