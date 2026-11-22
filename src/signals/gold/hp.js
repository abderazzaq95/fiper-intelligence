import { execute, executeLimit } from './execute.js';

/**
 * High-probability XAUUSD playbooks: target CLOSER than the stop, so each
 * trade wins more often than it loses. The catch is arithmetic — with a
 * target of half the stop, break-even is a 67% win rate before spread —
 * so these only count as edges if they clear that bar out of sample.
 *
 * Distances scale with the PREVIOUS day's ATR, so the same rule means the
 * same thing at $1,200 gold and at $4,000 gold.
 *
 * London clock minutes, monotonic within a gold day (context.js):
 * 23:30 the evening before = −30, 07:00 = 420.
 */
const LON = h => Math.round(h * 60);

function win(ctx, k, from, to) {
  const { d, lonMin } = ctx;
  let a = -1, b = -1;
  for (let i = d.i0[k]; i <= d.i1[k]; i++) if (lonMin[i] >= from && lonMin[i] < to) { if (a < 0) a = i; b = i; }
  return a < 0 ? null : [a, b];
}
function exitAt(ctx, k, lonClock) {
  const { m, d, lonMin } = ctx;
  for (let i = d.i0[k]; i <= d.i1[k]; i++) if (lonMin[i] >= lonClock) return m.t[i];
  return m.t[d.i1[k]] + 60;
}

/* ------------------------------------------------------------------ */
/* 1. Asian-session stretch fade                                       */
/* ------------------------------------------------------------------ */

export const ASIA_FADE = {
  id: 'AF',
  name: 'Asian-session stretch fade (back toward session average)',
  grid: { stretch: [0.12, 0.18, 0.25], tpFrac: [0.5, 1.0], slMult: [1.0, 1.5] },
  run(ctx, p) {
    const { m, d, atrPrev } = ctx, trades = [];
    for (let k = 20; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      // Skip the rollover hour: spreads are wide and prints unreliable until ~23:30 London
      const sw = win(ctx, k, LON(-0.5), LON(5.5)); if (!sw) continue;
      const tExit = exitAt(ctx, k, LON(7));
      let sum = 0, cnt = 0, doneUp = false, doneDn = false, busyUntil = -1;
      for (let i = sw[0]; i <= sw[1]; i++) {
        sum += m.c[i]; cnt++;
        const avg = sum / cnt;
        if (cnt < 60 || i < busyUntil) continue;  // let the average settle for an hour first
        const dist = m.c[i] - avg;
        const dir = dist > p.stretch * atr && !doneUp ? -1 : dist < -p.stretch * atr && !doneDn ? 1 : 0;
        if (!dir) continue;
        if (dir < 0) doneUp = true; else doneDn = true;
        const ref = m.c[i], gap = Math.abs(dist);
        const tp = ref + dir * p.tpFrac * gap;            // the session average AT ENTRY is the target — fixed, no look-ahead
        const stop = ref - dir * p.slMult * gap;
        const res = execute(m, i + 1, { dir, stop, tp, exitAt: tExit });
        if (res) { trades.push({ ...res, dir, day: k }); busyUntil = res.exitIdx; }
      }
    }
    return trades;
  }
};

/* ------------------------------------------------------------------ */
/* 2. London trend pullback scalp                                      */
/* ------------------------------------------------------------------ */

export const LONDON_PULLBACK = {
  id: 'LPB',
  name: 'London trend-day pullback scalp',
  grid: { trendAtr: [0.15, 0.25], tpAtr: [0.08, 0.12], slAtr: [0.15, 0.25], depth: [0.38, 0.5] },
  run(ctx, p) {
    const { m, d, atrPrev } = ctx, trades = [];
    for (let k = 20; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      const w = win(ctx, k, LON(7), LON(9)); if (!w) continue;
      const open = m.o[w[0]], at9 = m.c[w[1]];
      const move = at9 - open;
      if (Math.abs(move) < p.trendAtr * atr) continue;
      const dir = Math.sign(move);
      // Extreme of the move so far → the pullback level is a fixed retrace of it
      let ext = dir > 0 ? -Infinity : Infinity;
      for (let i = w[0]; i <= w[1]; i++) ext = dir > 0 ? Math.max(ext, m.h[i]) : Math.min(ext, m.l[i]);
      const limit = ext - dir * p.depth * Math.abs(ext - open);
      const tExit = exitAt(ctx, k, LON(16));
      const expiry = exitAt(ctx, k, LON(12));
      const res = executeLimit(m, w[1] + 1, expiry, {
        dir, limit, stop: limit - dir * p.slAtr * atr, tp: limit + dir * p.tpAtr * atr, exitAt: tExit
      });
      if (res) trades.push({ ...res, dir, day: k });
    }
    return trades;
  }
};

/* ------------------------------------------------------------------ */
/* 3. Prior-day high/low first-touch fade                              */
/* ------------------------------------------------------------------ */

export const LEVEL_FADE = {
  id: 'LF',
  name: 'Prior-day high/low first-touch fade',
  grid: { tpAtr: [0.08, 0.12], slAtr: [0.2, 0.3], minRoom: [0.15, 0.3], offset: [0, 0.03] },
  run(ctx, p) {
    const { m, d, atrPrev } = ctx, trades = [];
    for (let k = 21; k < d.n; k++) {
      const atr = atrPrev[k]; if (!(atr > 0)) continue;
      const w = win(ctx, k, LON(7), LON(16)); if (!w) continue;
      const pdh = d.h[k - 1], pdl = d.l[k - 1], px = m.o[w[0]];
      // Only levels the market has to travel to — not ones it opened on top of
      const sides = [];
      if (pdh - px >= p.minRoom * atr) sides.push({ dir: -1, limit: pdh + p.offset * atr });
      if (px - pdl >= p.minRoom * atr) sides.push({ dir: 1, limit: pdl - p.offset * atr });
      // Already traded through overnight? Then it is not a first touch
      let preH = -Infinity, preL = Infinity;
      for (let i = d.i0[k]; i < w[0]; i++) { preH = Math.max(preH, m.h[i]); preL = Math.min(preL, m.l[i]); }
      const tExit = exitAt(ctx, k, LON(20));
      for (const s of sides) {
        if (s.dir < 0 ? preH >= pdh : preL <= pdl) continue;
        const res = executeLimit(m, w[0], m.t[w[1]], {
          dir: s.dir, limit: s.limit, stop: s.limit - s.dir * p.slAtr * atr, tp: s.limit + s.dir * p.tpAtr * atr, exitAt: tExit
        });
        if (res) trades.push({ ...res, dir: s.dir, day: k });
      }
    }
    return trades.sort((a, b) => a.entryT - b.entryT);
  }
};

export const HP_STRATEGIES = [ASIA_FADE, LONDON_PULLBACK, LEVEL_FADE];
