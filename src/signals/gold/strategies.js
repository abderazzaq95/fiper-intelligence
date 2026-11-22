import { execute } from './execute.js';

/**
 * Gold-specific intraday playbooks. Each one walks the gold trading days,
 * finds at most ONE setup per day, and replays it minute by minute with
 * real bid/ask fills. Every input a rule reads is known at decision time.
 *
 * Parameter grids are deliberately small (≤ 36 combinations): the more
 * combinations searched, the more a "winner" is just luck. Selection
 * happens in research.js on 2016–2021 only.
 */

/** Signal-bar closes are judged on 5-minute bars built on the fly from minutes. */
function* fiveMinuteCloses(ctx, from, to) {
  const { m } = ctx;
  let start = from;
  for (let i = from; i <= to; i++) {
    const endOfBar = (Math.floor(m.t[i] / 300) !== Math.floor((m.t[i + 1] ?? Infinity) / 300));
    if (endOfBar) {
      let h = -Infinity, l = Infinity;
      for (let k = start; k <= i; k++) { if (m.h[k] > h) h = m.h[k]; if (m.l[k] < l) l = m.l[k]; }
      yield { i, c: m.c[i], h, l };
      start = i + 1;
    }
  }
}

/** Minute indices of day k whose local clock (minutes) falls in [from, to). */
function window(ctx, k, clockArr, from, to) {
  const { d } = ctx;
  let a = -1, b = -1;
  for (let i = d.i0[k]; i <= d.i1[k]; i++) {
    const mm = clockArr[i];
    if (mm >= from && mm < to) { if (a < 0) a = i; b = i; }
  }
  return a < 0 ? null : [a, b];
}

function rangeOf(m, a, b) {
  let h = -Infinity, l = Infinity;
  for (let i = a; i <= b; i++) { if (m.h[i] > h) h = m.h[i]; if (m.l[i] < l) l = m.l[i]; }
  return { h, l };
}

const H = h => h * 60;

/* ---------------- 1. London opening-range breakout ---------------- */

export const LONDON_ORB = {
  id: 'LORB',
  name: 'London opening-range breakout',
  grid: { rangeEnd: [7, 8], stopMode: ['opp', 'mid'], tpR: [1, 1.5, 2], maxRangeAtr: [0.6, 1.0], be: [null, 0.6] },
  run(ctx, p) {
    const { m, d, lonMin, atrPrev } = ctx, trades = [];
    for (let k = 20; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      const rw = window(ctx, k, lonMin, 0, H(p.rangeEnd)); if (!rw) continue;
      const r = rangeOf(m, rw[0], rw[1]);
      const width = r.h - r.l;
      if (width > p.maxRangeAtr * atr || width < 0.1 * atr) continue;
      const tw = window(ctx, k, lonMin, H(p.rangeEnd), H(p.rangeEnd + 3)); if (!tw) continue;
      const exitAt = exitTime(ctx, k, lonMin, H(20));
      for (const bar of fiveMinuteCloses(ctx, tw[0], tw[1])) {
        const dir = bar.c > r.h ? 1 : bar.c < r.l ? -1 : 0;
        if (!dir) continue;
        const stop = p.stopMode === 'opp' ? (dir > 0 ? r.l : r.h) : (r.h + r.l) / 2;
        const entryRef = m.c[bar.i];
        const risk = Math.abs(entryRef - stop);
        const res = execute(m, bar.i + 1, { dir, stop, tp: entryRef + dir * p.tpR * risk, exitAt, beAt: p.be });
        if (res) trades.push({ ...res, dir, day: k });
        break; // first break of the day only
      }
    }
    return trades;
  }
};

/* ---------------- 2. New York (COMEX) open breakout ---------------- */

export const NY_ORB = {
  id: 'NYORB',
  name: 'New York open breakout',
  // COMEX gold opens 08:20 New York; the US data releases land at 08:30
  grid: { orMinutes: [15, 30, 60], stopMode: ['opp', 'mid'], tpR: [1, 1.5, 2], be: [null, 0.6] },
  run(ctx, p) {
    const { m, d, nyMin, atrPrev } = ctx, trades = [];
    const start = 8 * 60 + 20;
    for (let k = 20; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      const rw = window(ctx, k, nyMin, start, start + p.orMinutes); if (!rw) continue;
      const r = rangeOf(m, rw[0], rw[1]);
      const width = r.h - r.l;
      if (width < 0.08 * atr || width > 0.9 * atr) continue;
      const tw = window(ctx, k, nyMin, start + p.orMinutes, 12 * 60); if (!tw) continue;
      const exitAt = exitTime(ctx, k, nyMin, H(16));
      for (const bar of fiveMinuteCloses(ctx, tw[0], tw[1])) {
        const dir = bar.c > r.h ? 1 : bar.c < r.l ? -1 : 0;
        if (!dir) continue;
        const stop = p.stopMode === 'opp' ? (dir > 0 ? r.l : r.h) : (r.h + r.l) / 2;
        const entryRef = m.c[bar.i];
        const risk = Math.abs(entryRef - stop);
        const res = execute(m, bar.i + 1, { dir, stop, tp: entryRef + dir * p.tpR * risk, exitAt, beAt: p.be });
        if (res) trades.push({ ...res, dir, day: k });
        break;
      }
    }
    return trades;
  }
};

/* ---------------- 3. Prior-day high/low breakout with trend ---------------- */

export const PDHL_BREAK = {
  id: 'PDB',
  name: 'Prior-day high/low breakout (with daily trend)',
  grid: { stopAtr: [0.3, 0.5], tpR: [1, 1.5, 2.5], trend: [true, false], be: [null, 0.6] },
  run(ctx, p) {
    const { m, d, lonMin, atrPrev, ema20Prev } = ctx, trades = [];
    for (let k = 21; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      const pdh = d.h[k - 1], pdl = d.l[k - 1];
      const up = d.c[k - 1] > ema20Prev[k], down = d.c[k - 1] < ema20Prev[k];
      // London open → New York afternoon: when gold's liquid sessions run
      const tw = window(ctx, k, lonMin, H(7), H(17)); if (!tw) continue;
      const exitAt = exitTime(ctx, k, lonMin, H(20));
      for (const bar of fiveMinuteCloses(ctx, tw[0], tw[1])) {
        let dir = bar.c > pdh ? 1 : bar.c < pdl ? -1 : 0;
        if (!dir) continue;
        if (p.trend && ((dir > 0 && !up) || (dir < 0 && !down))) break;
        const entryRef = m.c[bar.i];
        const stop = entryRef - dir * p.stopAtr * atr;
        const res = execute(m, bar.i + 1, { dir, stop, tp: entryRef + dir * p.tpR * p.stopAtr * atr, exitAt, beAt: p.be });
        if (res) trades.push({ ...res, dir, day: k });
        break;
      }
    }
    return trades;
  }
};

/* ---------------- 4. Prior-day high/low sweep and reverse ---------------- */

export const PDHL_SWEEP = {
  id: 'PDS',
  name: 'Prior-day high/low sweep & reverse',
  // Price runs the stops above yesterday's high (or below its low), then closes back inside
  grid: { sweepAtr: [0.05, 0.15], stopBuf: [0.1, 0.25], target: ['1R', '1.5R', 'mid'], be: [null, 0.6] },
  run(ctx, p) {
    const { m, d, lonMin, atrPrev } = ctx, trades = [];
    for (let k = 21; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      const pdh = d.h[k - 1], pdl = d.l[k - 1], mid = (pdh + pdl) / 2;
      const tw = window(ctx, k, lonMin, H(7), H(17)); if (!tw) continue;
      const exitAt = exitTime(ctx, k, lonMin, H(20));
      let hi = -Infinity, lo = Infinity;
      for (const bar of fiveMinuteCloses(ctx, tw[0], tw[1])) {
        hi = Math.max(hi, bar.h); lo = Math.min(lo, bar.l);
        let dir = 0;
        if (hi > pdh + p.sweepAtr * atr && bar.c < pdh) dir = -1;
        else if (lo < pdl - p.sweepAtr * atr && bar.c > pdl) dir = 1;
        if (!dir) continue;
        const entryRef = m.c[bar.i];
        const stop = dir < 0 ? hi + p.stopBuf * atr : lo - p.stopBuf * atr;
        const risk = Math.abs(entryRef - stop);
        const tp = p.target === 'mid' ? mid : entryRef + dir * parseFloat(p.target) * risk;
        if (dir * (tp - entryRef) <= 0) break;
        const res = execute(m, bar.i + 1, { dir, stop, tp, exitAt, beAt: p.be });
        if (res) trades.push({ ...res, dir, day: k });
        break;
      }
    }
    return trades;
  }
};

/** Unix time when the session clock first reaches `min` on gold day k (else the day's end). Clocks are monotonic within a gold day — see context.js. */
function exitTime(ctx, k, clockArr, min) {
  const { m, d } = ctx;
  for (let i = d.i0[k]; i <= d.i1[k]; i++) if (clockArr[i] >= min) return m.t[i];
  return m.t[d.i1[k]] + 60;
}

export const GOLD_STRATEGIES = [LONDON_ORB, NY_ORB, PDHL_BREAK, PDHL_SWEEP];

/** All parameter combinations of a grid. */
export function combos(grid) {
  return Object.entries(grid).reduce((acc, [k, vals]) => acc.flatMap(a => vals.map(v => ({ ...a, [k]: v }))), [{}]);
}
