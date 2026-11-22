import { execute } from './execute.js';

/**
 * Second-generation XAUUSD playbooks, each built on a documented effect
 * rather than on chart patterns:
 *
 *   VB   volatility breakout (Williams): a move of k × yesterday's range
 *        away from today's open tends to carry into the close
 *   IMOM intraday momentum (Gao, Han, Li & Zhou 2018): the overnight +
 *        US-morning move predicts the move into the COMEX close
 *   NEWS 08:30 New York data impulse (CPI, payrolls, …): the first five
 *        minutes' direction either continues or reverses — both tested
 *   BIG  after an outsized daily candle, next day follows or fades
 *
 * New York clock minutes, monotonic within a gold day (context.js):
 * 17:00 the evening before = −420, 08:30 = 510.
 */
const NY = (h, mm = 0) => h * 60 + mm;

function firstAt(ctx, k, clock) {
  const { d, nyMin } = ctx;
  for (let i = d.i0[k]; i <= d.i1[k]; i++) if (nyMin[i] >= clock) return i;
  return -1;
}
const timeAt = (ctx, k, clock) => { const i = firstAt(ctx, k, clock); return i < 0 ? ctx.m.t[ctx.d.i1[k]] + 60 : ctx.m.t[i]; };

/* ---------------- VB — volatility breakout ---------------- */

const volCache = new WeakMap();
/** elevated[k]: ATR%-of-price known at the start of day k is above the median of the previous 100 days. */
export function volElevated(ctx) {
  if (volCache.has(ctx.m)) return volCache.get(ctx.m);
  const { d, atrPrev } = ctx;
  const pctv = Array.from({ length: d.n }, (_, k) => atrPrev[k] / d.o[k]);
  const out = new Uint8Array(d.n);
  for (let k = 0; k < d.n; k++) {
    const hist = pctv.slice(Math.max(0, k - 100), k).filter(Number.isFinite);
    if (hist.length < 40 || !Number.isFinite(pctv[k])) continue; // not enough history to judge — stand aside
    hist.sort((a, b) => a - b);
    out[k] = pctv[k] > hist[hist.length >> 1] ? 1 : 0;
  }
  volCache.set(ctx.m, out);
  return out;
}

export const VOL_BREAKOUT = {
  id: 'VB',
  name: 'Volatility breakout (open ± k × prior range, hold to close)',
  // vol: "all" trades every day; "high" only when volatility (ATR as % of price) is above its own
  // 100-day median — breakouts need expansion to follow through. The rule is fixed in advance, not fitted.
  grid: { k: [0.3, 0.5, 0.7], stopFrac: [0.5, 1.0], exit: ['eod', '2R'], from: ['asia', 'london'], vol: ['all', 'high'] },
  run(ctx, p) {
    const { m, d } = ctx, trades = [];
    const elevated = p.vol === 'high' ? volElevated(ctx) : null;
    for (let k = 2; k < d.n; k++) {
      if (elevated && !elevated[k]) continue;
      const range = d.h[k - 1] - d.l[k - 1];
      if (!(range > 0)) continue;
      const open = d.o[k];
      const up = open + p.k * range, dn = open - p.k * range;
      // Skip the first hour (rollover spreads); "london" waits for real liquidity
      const start = firstAt(ctx, k, p.from === 'asia' ? NY(-6) : NY(2)); if (start < 0) continue;
      const last = firstAt(ctx, k, NY(12)); if (last < 0) continue;
      const tExit = timeAt(ctx, k, NY(16, 30));
      for (let i = start; i < last; i++) {
        const dir = m.h[i] + m.sp[i] >= up ? 1 : m.l[i] <= dn ? -1 : 0;
        if (!dir) continue;
        const level = dir > 0 ? up : dn;
        const stop = level - dir * p.stopFrac * p.k * range;
        const risk = Math.abs(level - stop);
        const res = execute(m, i + 1, { dir, stop, tp: p.exit === '2R' ? level + dir * 2 * risk : null, exitAt: tExit });
        if (res) trades.push({ ...res, dir, day: k });
        break;
      }
    }
    return trades;
  }
};

/* ---------------- IMOM — intraday momentum ---------------- */

export const INTRADAY_MOMENTUM = {
  id: 'IMOM',
  name: 'Intraday momentum (overnight + US morning → into COMEX close)',
  grid: { signalAt: [NY(9, 30), NY(10, 30)], minMove: [0, 0.2, 0.4], stopAtr: [0.3, 0.6], exitAt: [NY(13, 30), NY(16)] },
  run(ctx, p) {
    const { m, d, atrPrev } = ctx, trades = [];
    for (let k = 2; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      const i = firstAt(ctx, k, p.signalAt); if (i < 0) continue;
      const move = m.c[i] - d.o[k];
      if (Math.abs(move) < p.minMove * atr) continue;
      const dir = Math.sign(move);
      const res = execute(m, i + 1, { dir, stop: m.c[i] - dir * p.stopAtr * atr, tp: null, exitAt: timeAt(ctx, k, p.exitAt) });
      if (res) trades.push({ ...res, dir, day: k });
    }
    return trades;
  }
};

/* ---------------- NEWS — 08:30 data impulse ---------------- */

export const NEWS_IMPULSE = {
  id: 'NEWS',
  name: '08:30 NY data impulse (follow or fade the first 5 minutes)',
  grid: { minMoveAtr: [0.08, 0.12, 0.18], mode: ['follow', 'fade'], target: ['1R', '2R', 'time'] },
  run(ctx, p) {
    const { m, d, atrPrev } = ctx, trades = [];
    for (let k = 2; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      const a = firstAt(ctx, k, NY(8, 30)), b = firstAt(ctx, k, NY(8, 35));
      if (a < 0 || b < 0 || b - a < 3) continue;
      let hi = -Infinity, lo = Infinity;
      for (let i = a; i < b; i++) { hi = Math.max(hi, m.h[i]); lo = Math.min(lo, m.l[i]); }
      const move = m.c[b - 1] - m.o[a];
      // A big first-five-minutes move only happens on data days — no calendar needed to find them
      if (Math.abs(move) < p.minMoveAtr * atr) continue;
      const dir = p.mode === 'follow' ? Math.sign(move) : -Math.sign(move);
      const ref = m.c[b - 1];
      const stop = dir > 0 ? Math.min(lo, ref - 0.05 * atr) - 0.02 * atr : Math.max(hi, ref + 0.05 * atr) + 0.02 * atr;
      const risk = Math.abs(ref - stop);
      if (risk > 0.6 * atr) continue; // impulse too violent to risk-manage
      const tp = p.target === 'time' ? null : ref + dir * parseFloat(p.target) * risk;
      const res = execute(m, b, { dir, stop, tp, exitAt: timeAt(ctx, k, NY(11)) }, { slip: 0.15, maxSpread: 2.5 });
      if (res) trades.push({ ...res, dir, day: k });
    }
    return trades;
  }
};

/* ---------------- BIG — day after an outsized candle ---------------- */

export const BIG_DAY = {
  id: 'BIG',
  name: 'Day after an outsized daily candle (follow or fade)',
  grid: { mult: [1.5, 2.0], mode: ['follow', 'fade'], stopAtr: [0.4, 0.7], target: ['1R', 'eod'] },
  run(ctx, p) {
    const { m, d, atrPrev } = ctx, trades = [];
    for (let k = 2; k < d.n; k++) {
      const atr = atrPrev[k - 1]; if (!(atr > 0)) continue;
      const r = d.h[k - 1] - d.l[k - 1];
      if (r < p.mult * atr) continue;
      const loc = (d.c[k - 1] - d.l[k - 1]) / r;
      if (loc > 0.25 && loc < 0.75) continue; // only candles that CLOSED near an extreme
      const trendDir = loc >= 0.75 ? 1 : -1;
      const dir = p.mode === 'follow' ? trendDir : -trendDir;
      const i = firstAt(ctx, k, NY(2)); if (i < 0) continue; // London open
      const atrNow = atrPrev[k];
      const stop = m.c[i] - dir * p.stopAtr * atrNow;
      const res = execute(m, i + 1, { dir, stop, tp: p.target === '1R' ? m.c[i] + dir * p.stopAtr * atrNow : null, exitAt: timeAt(ctx, k, NY(16)) });
      if (res) trades.push({ ...res, dir, day: k });
    }
    return trades;
  }
};

export const DISCOVER_STRATEGIES = [VOL_BREAKOUT, INTRADAY_MOMENTUM, NEWS_IMPULSE, BIG_DAY];
