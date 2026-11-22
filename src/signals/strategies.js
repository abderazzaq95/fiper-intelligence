/**
 * Setup detectors. Each looks at the CLOSED bar i (and earlier bars only)
 * and either returns { dir, stop } or null. They are deliberately simple
 * and well-known — the edge is not meant to come from any one rule, but
 * from the probability model that decides which of these setups, in
 * which conditions, have historically followed through.
 *
 * dir: +1 long, -1 short. stop: a price level beyond structure.
 */
const range = b => b.h - b.l;
const closeLoc = (b, dir) => {
  const r = range(b); if (r <= 0) return 0.5;
  return dir > 0 ? (b.c - b.l) / r : (b.h - b.c) / r;
};

/** Trend pullback: trend intact, price dips to the 20 EMA and closes back with the trend. */
function trendPullback(bars, x, i) {
  const b = bars[i], a = x.atr[i];
  for (const dir of [1, -1]) {
    const trend = dir > 0
      ? x.ema50[i] > x.ema200[i] && b.c > x.ema200[i]
      : x.ema50[i] < x.ema200[i] && b.c < x.ema200[i];
    if (!trend || x.adx[i] < 18) continue;
    const recent = bars.slice(i - 2, i + 1);
    const touched = dir > 0
      ? Math.min(...recent.map(k => k.l)) <= x.ema20[i] + 0.2 * a
      : Math.max(...recent.map(k => k.h)) >= x.ema20[i] - 0.2 * a;
    const reclaimed = dir > 0 ? b.c > x.ema20[i] && b.c > b.o : b.c < x.ema20[i] && b.c < b.o;
    const rsiOk = dir > 0 ? x.rsi[i] > 40 && x.rsi[i] < 70 : x.rsi[i] < 60 && x.rsi[i] > 30;
    if (touched && reclaimed && rsiOk && closeLoc(b, dir) >= 0.55) {
      const stop = dir > 0 ? Math.min(...recent.map(k => k.l)) - 0.2 * a : Math.max(...recent.map(k => k.h)) + 0.2 * a;
      return { dir, stop };
    }
  }
  return null;
}

/** Liquidity sweep: price runs the prior day's stops, then closes back inside with a long rejection wick. */
function liquiditySweep(bars, x, i) {
  const b = bars[i], a = x.atr[i], r = range(b);
  if (r < 0.8 * a) return null;
  if (b.l < x.ll24[i] && b.c > x.ll24[i] && (Math.min(b.o, b.c) - b.l) / r >= 0.45) {
    return { dir: 1, stop: b.l - 0.15 * a };
  }
  if (b.h > x.hh24[i] && b.c < x.hh24[i] && (b.h - Math.max(b.o, b.c)) / r >= 0.45) {
    return { dir: -1, stop: b.h + 0.15 * a };
  }
  return null;
}

/** Range mean reversion: in a low-ADX regime, a close outside the band that snaps back inside. */
function meanReversion(bars, x, i) {
  if (x.adx[i] >= 22) return null;
  const b = bars[i], p = bars[i - 1], a = x.atr[i];
  if (p.c < x.bbLo[i - 1] && b.c > x.bbLo[i] && b.c > b.o) {
    return { dir: 1, stop: Math.min(b.l, p.l) - 0.2 * a };
  }
  if (p.c > x.bbUp[i - 1] && b.c < x.bbUp[i] && b.c < b.o) {
    return { dir: -1, stop: Math.max(b.h, p.h) + 0.2 * a };
  }
  return null;
}

/** Momentum breakout: a strong close through the prior 24-bar extreme, with trend and rising ADX. */
function breakout(bars, x, i) {
  const b = bars[i], a = x.atr[i];
  if (x.adx[i] < 20 || x.adx[i] <= x.adx[i - 3] || range(b) > 2.5 * a) return null;
  for (const dir of [1, -1]) {
    const through = dir > 0 ? b.c > x.hh24[i] && x.ema50[i] > x.ema200[i] : b.c < x.ll24[i] && x.ema50[i] < x.ema200[i];
    if (through && closeLoc(b, dir) >= 0.7) {
      const dist = Math.min(Math.max(dir > 0 ? b.c - b.l : b.h - b.c, 0.6 * a), 2 * a) + 0.1 * a;
      return { dir, stop: b.c - dir * dist };
    }
  }
  return null;
}

/**
 * Volatility squeeze: bands at their narrowest in ~5 days, then a close
 * outside them in the direction of the 200 EMA. Compression precedes
 * expansion; the trend filter picks the side.
 */
function squeeze(bars, x, i) {
  const b = bars[i], a = x.atr[i];
  const wasTight = Math.min(x.bbWidthRank[i - 1], x.bbWidthRank[i - 2], x.bbWidthRank[i - 3]) <= 0.15;
  if (!wasTight) return null;
  for (const dir of [1, -1]) {
    const out = dir > 0 ? b.c > x.bbUp[i] && b.c > x.ema200[i] : b.c < x.bbLo[i] && b.c < x.ema200[i];
    if (out && closeLoc(b, dir) >= 0.6) {
      const dist = Math.min(Math.max(dir > 0 ? b.c - b.l : b.h - b.c, 0.7 * a), 2 * a) + 0.1 * a;
      return { dir, stop: b.c - dir * dist };
    }
  }
  return null;
}

/**
 * Session opening-range breakout: the range built while the instrument's
 * main session is shut, broken in the first hours after it opens. Hours
 * are UTC. Gold: Asia range broken in London. Nasdaq: European-hours
 * range broken after the US cash open. Bitcoin: Asia range broken in the
 * US session, where most of its volume trades.
 */
const ORB_WINDOWS = {
  XAUUSD: { range: [0, 7], trade: [7, 11] },
  USTEC:  { range: [7, 13], trade: [13, 17] },
  BTCUSD: { range: [0, 8], trade: [13, 17] }
};
function sessionBreakout(bars, x, i, key) {
  const w = ORB_WINDOWS[key]; if (!w) return null;
  const b = bars[i], h = new Date(b.t).getUTCHours(), a = x.atr[i];
  if (h < w.trade[0] || h >= w.trade[1]) return null;
  const dayStart = b.t - h * 3600_000;
  let hi = -Infinity, lo = Infinity, cnt = 0, j = i - 1;
  for (; j >= 0 && bars[j].t >= dayStart; j--) {
    const hj = new Date(bars[j].t).getUTCHours();
    if (hj >= w.range[0] && hj < w.range[1]) { hi = Math.max(hi, bars[j].h); lo = Math.min(lo, bars[j].l); cnt++; }
  }
  if (cnt < 4 || hi - lo > 3 * a) return null; // need a real range, and not one already blown out
  // Only the FIRST close through the range counts — later ones are chasing
  for (let k = j + 1; k < i; k++) {
    const hk = new Date(bars[k].t).getUTCHours();
    if (hk >= w.trade[0] && (bars[k].c > hi || bars[k].c < lo)) return null;
  }
  if (b.c > hi && closeLoc(b, 1) >= 0.6) return { dir: 1, stop: Math.max(lo, b.c - 2 * a) - 0.1 * a };
  if (b.c < lo && closeLoc(b, -1) >= 0.6) return { dir: -1, stop: Math.min(hi, b.c + 2 * a) + 0.1 * a };
  return null;
}

export const STRATEGIES = [
  { id: 'TPB', name: 'Trend Pullback', detect: trendPullback },
  { id: 'SWP', name: 'Liquidity Sweep', detect: liquiditySweep },
  { id: 'MR',  name: 'Range Mean-Reversion', detect: meanReversion },
  { id: 'BRK', name: 'Momentum Breakout', detect: breakout },
  { id: 'SQZ', name: 'Volatility Squeeze Breakout', detect: squeeze },
  { id: 'ORB', name: 'Session Opening-Range Breakout', detect: sessionBreakout }
];

export const strategyById = id => STRATEGIES.find(s => s.id === id);
