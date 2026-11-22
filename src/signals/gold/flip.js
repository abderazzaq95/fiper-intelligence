import { execute, executeLimit, PIP } from './execute.js';
import { aggregate } from './m1.js';

/**
 * "Flip" playbooks for XAUUSD: small fixed-risk stops (≤ 20 pips = $2)
 * and large targets (3R–5R). Win rates of 20–35% are EXPECTED — the
 * edge, if any, comes from winners being several times the losers.
 *
 * With a $2 stop, the ~$0.25–0.30 spread is 12–15% of the risk on every
 * trade, so entries are taken at levels (sweeps, retests, pullbacks),
 * not by chasing breakouts. All three playbooks share the same honest
 * execution: real bid/ask, stop-first on ambiguous minutes, slippage.
 *
 * Time windows are London clock minutes, monotonic within a gold day
 * (see context.js): 07:00 = 420.
 */
const LON = h => Math.round(h * 60);
const MIN_STOP = 5 * PIP;   // below 5 pips the spread alone is a third of the risk

/** Minute index range of gold day k whose London clock is in [from, to). */
function win(ctx, k, from, to) {
  const { d, lonMin } = ctx;
  let a = -1, b = -1;
  for (let i = d.i0[k]; i <= d.i1[k]; i++) if (lonMin[i] >= from && lonMin[i] < to) { if (a < 0) a = i; b = i; }
  return a < 0 ? null : [a, b];
}
function hiLo(m, [a, b]) {
  let h = -Infinity, l = Infinity;
  for (let i = a; i <= b; i++) { if (m.h[i] > h) h = m.h[i]; if (m.l[i] < l) l = m.l[i]; }
  return { h, l };
}
function exitAt(ctx, k, lonClock) {
  const { m, d, lonMin } = ctx;
  for (let i = d.i0[k]; i <= d.i1[k]; i++) if (lonMin[i] >= lonClock) return m.t[i];
  return m.t[d.i1[k]] + 60;
}

/* ------------------------------------------------------------------ */
/* 1. Sweep & Reclaim                                                  */
/* ------------------------------------------------------------------ */

export const SWEEP_RECLAIM = {
  id: 'SR',
  name: 'Sweep & Reclaim (Asian range / prior-day levels)',
  grid: { rr: [3, 4, 5], sweepPips: [3, 8], maxStopPips: [15, 20], levels: ['asia', 'both'], be: [null, 1.5] },
  run(ctx, p) {
    const { m, d } = ctx, trades = [];
    for (let k = 2; k < d.n; k++) {
      const asiaW = win(ctx, k, 0, LON(7)); if (!asiaW) continue;
      const asia = hiLo(m, asiaW);
      const levels = [
        { px: asia.h, dir: -1 }, { px: asia.l, dir: 1 },
        ...(p.levels === 'both' ? [{ px: d.h[k - 1], dir: -1 }, { px: d.l[k - 1], dir: 1 }] : [])
      ].map(L => ({ ...L, state: 'idle', ext: NaN, since: -1 }));
      const tw = win(ctx, k, LON(7), LON(16)); if (!tw) continue;
      const tExit = exitAt(ctx, k, LON(20));
      let busyUntil = -1, taken = 0;

      for (let i = tw[0]; i <= tw[1] && taken < 2; i++) {
        for (const L of levels) {
          if (L.state === 'done') continue;
          const beyond = L.dir < 0 ? m.h[i] - L.px : L.px - m.l[i];
          if (L.state === 'idle' && beyond >= p.sweepPips * PIP) { L.state = 'swept'; L.since = i; L.ext = L.dir < 0 ? m.h[i] : m.l[i]; }
          if (L.state !== 'swept') continue;
          L.ext = L.dir < 0 ? Math.max(L.ext, m.h[i]) : Math.min(L.ext, m.l[i]);
          if (i - L.since > 30) { L.state = 'done'; continue; }       // no reclaim within 30 min → it was a real break
          const reclaimed = L.dir < 0 ? m.c[i] < L.px : m.c[i] > L.px;
          if (!reclaimed) continue;
          L.state = 'done';
          if (i < busyUntil) continue;
          const ref = m.c[i];
          let stop = L.ext - L.dir * 2 * PIP;                          // 2 pips beyond the sweep extreme
          let risk = L.dir * (ref - stop);
          if (risk > p.maxStopPips * PIP) continue;                    // sweep too deep for a flip stop — pass
          if (risk < MIN_STOP) { stop = ref - L.dir * MIN_STOP; risk = MIN_STOP; }
          const res = execute(m, i + 1, { dir: L.dir, stop, tp: ref + L.dir * p.rr * risk, exitAt: tExit, beAt: p.be });
          if (res) { trades.push({ ...res, dir: L.dir, day: k }); busyUntil = res.exitIdx; taken++; }
        }
      }
    }
    return trades;
  }
};

/* ------------------------------------------------------------------ */
/* 2. Break & Retest (limit order at the broken Asian edge)            */
/* ------------------------------------------------------------------ */

export const BREAK_RETEST = {
  id: 'BR',
  name: 'Asian-range Break & Retest (limit entry)',
  grid: { stopPips: [10, 15, 20], rr: [3, 4, 5], offsetPips: [0, 3] },
  run(ctx, p) {
    const { m, d } = ctx, trades = [];
    for (let k = 2; k < d.n; k++) {
      const asiaW = win(ctx, k, 0, LON(7)); if (!asiaW) continue;
      const asia = hiLo(m, asiaW);
      const tw = win(ctx, k, LON(7), LON(10)); if (!tw) continue;
      const tExit = exitAt(ctx, k, LON(17));
      // First 5-minute close beyond the range, by at least 2 pips
      let start = tw[0];
      for (let i = tw[0]; i <= tw[1]; i++) {
        if (Math.floor(m.t[i] / 300) === Math.floor((m.t[i + 1] ?? Infinity) / 300)) continue;
        const c = m.c[i]; start = i + 1;
        const dir = c > asia.h + 2 * PIP ? 1 : c < asia.l - 2 * PIP ? -1 : 0;
        if (!dir) continue;
        const edge = dir > 0 ? asia.h : asia.l;
        const limit = edge + dir * p.offsetPips * PIP;
        const stop = limit - dir * p.stopPips * PIP;
        const tp = limit + dir * p.rr * p.stopPips * PIP;
        const res = executeLimit(m, start, Math.min(m.t[i] + 90 * 60, tExit), { dir, limit, stop, tp, exitAt: tExit });
        if (res) trades.push({ ...res, dir, day: k });
        break;
      }
    }
    return trades;
  }
};

/* ------------------------------------------------------------------ */
/* 3. Trend Micro-Pullback (H1 trend, M5 pullback to EMA20)            */
/* ------------------------------------------------------------------ */

function emaArr(src, n) {
  const out = new Float64Array(src.length).fill(NaN), k = 2 / (n + 1);
  let e = NaN;
  for (let i = 0; i < src.length; i++) { e = i === 0 ? src[0] : e + k * (src[i] - e); if (i >= n - 1) out[i] = e; }
  return out;
}

let cache = null;
function microContext(ctx) {
  if (cache?.m === ctx.m) return cache;
  const { m } = ctx;
  const m5 = aggregate(m, 5), h1 = aggregate(m, 60);
  const e20 = emaArr(m5.c, 20);
  const h50 = emaArr(h1.c, 50), h200 = emaArr(h1.c, 200);
  // For each M5 bar: the last H1 bar that had CLOSED by the M5 bar's close
  const h1Idx = new Int32Array(m5.n);
  for (let j = 0, q = -1; j < m5.n; j++) {
    const end = m5.t[j] + 300;
    while (q + 1 < h1.n && h1.t[q + 1] + 3600 <= end) q++;
    h1Idx[j] = q;
  }
  // Gold day of each M5 bar, via the day index of its last minute
  const dayOfMin = new Int32Array(m.n);
  for (let k = 0; k < ctx.d.n; k++) for (let i = ctx.d.i0[k]; i <= ctx.d.i1[k]; i++) dayOfMin[i] = k;
  cache = { m, m5, h1, e20, h50, h200, h1Idx, dayOfMin };
  return cache;
}

export const MICRO_PULLBACK = {
  id: 'TMP',
  name: 'Trend Micro-Pullback (H1 trend, M5 entry)',
  grid: { rr: [3, 4, 5], maxStopPips: [12, 20], be: [null, 1.5] },
  run(ctx, p) {
    const { m, lonMin } = ctx;
    const X = microContext(ctx), { m5, e20, h50, h200, h1, h1Idx, dayOfMin } = X;
    const trades = [];
    let busyUntil = -1;
    const perDay = new Map();
    for (let j = 6; j < m5.n - 1; j++) {
      const last = m5.i1[j];
      if (last < busyUntil) continue;
      const lc = lonMin[last];
      if (lc < LON(7) || lc >= LON(19)) continue;
      const q = h1Idx[j]; if (q < 200) continue;
      const up = h50[q] > h200[q] && h1.c[q] > h50[q];
      const down = h50[q] < h200[q] && h1.c[q] < h50[q];
      if (!up && !down) continue;
      const dir = up ? 1 : -1;
      const c = m5.c[j];
      // Pullback: one of the last 3 bars tagged the M5 20 EMA; trigger: close through the previous bar's extreme
      let tagged = false;
      for (let b = j - 2; b <= j; b++) if (dir > 0 ? m5.l[b] <= e20[b] : m5.h[b] >= e20[b]) tagged = true;
      const trigger = dir > 0 ? c > e20[j] && c > m5.h[j - 1] : c < e20[j] && c < m5.l[j - 1];
      if (!tagged || !trigger) continue;
      let ext = dir > 0 ? Infinity : -Infinity;
      for (let b = j - 5; b <= j; b++) ext = dir > 0 ? Math.min(ext, m5.l[b]) : Math.max(ext, m5.h[b]);
      const stop = ext - dir * 2 * PIP;
      const risk = dir * (c - stop);
      if (risk > p.maxStopPips * PIP || risk < MIN_STOP) continue;
      const k = dayOfMin[last];
      if ((perDay.get(k) ?? 0) >= 3) continue;
      const res = execute(m, last + 1, { dir, stop, tp: c + dir * p.rr * risk, exitAt: exitAt(ctx, k, LON(21)), beAt: p.be });
      if (!res) continue;
      trades.push({ ...res, dir, day: k });
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
      busyUntil = res.exitIdx;
    }
    return trades;
  }
};

export const FLIP_STRATEGIES = [SWEEP_RECLAIM, BREAK_RETEST, MICRO_PULLBACK];
