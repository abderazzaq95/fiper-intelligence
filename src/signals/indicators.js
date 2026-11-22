/**
 * Classic indicators as plain arrays aligned to the bars (NaN during
 * warm-up). Every value at index i uses only bars 0..i, which is what
 * keeps the backtest free of look-ahead. Wilder smoothing is used for
 * ATR/RSI/ADX to match what traders see on MT5 and TradingView.
 */
const nan = n => new Array(n).fill(NaN);

export function ema(src, period) {
  const out = nan(src.length);
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < src.length; i++) {
    if (i === period - 1) {
      let s = 0; for (let j = 0; j < period; j++) s += src[j];
      prev = s / period;
    } else if (i >= period) prev = src[i] * k + prev * (1 - k);
    out[i] = i >= period - 1 ? prev : NaN;
  }
  return out;
}

function wilder(src, period) {
  const out = nan(src.length);
  let prev = NaN, sum = 0;
  for (let i = 0; i < src.length; i++) {
    if (i < period) { sum += src[i]; if (i === period - 1) { prev = sum / period; out[i] = prev; } continue; }
    prev = (prev * (period - 1) + src[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function atr(bars, period = 14) {
  const tr = bars.map((b, i) => i === 0 ? b.h - b.l
    : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)));
  return wilder(tr, period);
}

export function rsi(close, period = 14) {
  const up = [0], dn = [0];
  for (let i = 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0));
  }
  const au = wilder(up, period), ad = wilder(dn, period);
  return au.map((u, i) => ad[i] === 0 ? 100 : 100 - 100 / (1 + u / ad[i]));
}

export function adx(bars, period = 14) {
  const n = bars.length, pdm = [0], ndm = [0], tr = [bars[0].h - bars[0].l];
  for (let i = 1; i < n; i++) {
    const upMove = bars[i].h - bars[i - 1].h, dnMove = bars[i - 1].l - bars[i].l;
    pdm.push(upMove > dnMove && upMove > 0 ? upMove : 0);
    ndm.push(dnMove > upMove && dnMove > 0 ? dnMove : 0);
    tr.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c)));
  }
  const str = wilder(tr, period), sp = wilder(pdm, period), sn = wilder(ndm, period);
  const dx = str.map((t, i) => {
    const pdi = 100 * sp[i] / t, ndi = 100 * sn[i] / t;
    return pdi + ndi === 0 ? 0 : 100 * Math.abs(pdi - ndi) / (pdi + ndi);
  });
  // ADX is a Wilder average of DX, started once DX itself is defined
  const start = period - 1, out = nan(n);
  const tail = wilder(dx.slice(start), period);
  for (let i = 0; i < tail.length; i++) out[i + start] = tail[i];
  return out;
}

export function bollinger(close, period = 20, mult = 2) {
  const mid = nan(close.length), up = nan(close.length), lo = nan(close.length);
  for (let i = period - 1; i < close.length; i++) {
    let s = 0, s2 = 0;
    for (let j = i - period + 1; j <= i; j++) { s += close[j]; s2 += close[j] * close[j]; }
    const m = s / period, sd = Math.sqrt(Math.max(0, s2 / period - m * m));
    mid[i] = m; up[i] = m + mult * sd; lo[i] = m - mult * sd;
  }
  return { mid, up, lo };
}

/** Highest high / lowest low of the PREVIOUS `period` bars (excludes bar i). */
export function priorExtremes(bars, period) {
  const hh = nan(bars.length), ll = nan(bars.length);
  for (let i = period; i < bars.length; i++) {
    let h = -Infinity, l = Infinity;
    for (let j = i - period; j < i; j++) { if (bars[j].h > h) h = bars[j].h; if (bars[j].l < l) l = bars[j].l; }
    hh[i] = h; ll[i] = l;
  }
  return { hh, ll };
}

/** Where value i sits among the previous `period` values, 0..1. */
export function rank(src, period) {
  const out = nan(src.length);
  for (let i = period; i < src.length; i++) {
    let below = 0, cnt = 0;
    for (let j = i - period; j < i; j++) if (Number.isFinite(src[j])) { cnt++; if (src[j] < src[i]) below++; }
    out[i] = cnt ? below / cnt : NaN;
  }
  return out;
}

export function computeIndicators(bars) {
  const close = bars.map(b => b.c);
  const bb = bollinger(close, 20, 2);
  const ex24 = priorExtremes(bars, 24);
  const a = atr(bars, 14);
  const bbWidth = bb.up.map((u, i) => (u - bb.lo[i]) / bb.mid[i]);
  return {
    close,
    ema20: ema(close, 20), ema50: ema(close, 50), ema200: ema(close, 200),
    // ~20 trading days of hourly bars — the daily trend without a second feed
    ema480: ema(close, 480),
    atr: a, atrRank: rank(a, 200), atrSlow: ema(a, 120),
    bbWidthRank: rank(bbWidth, 120),
    rsi: rsi(close, 14), adx: adx(bars, 14),
    bbUp: bb.up, bbMid: bb.mid, bbLo: bb.lo,
    hh24: ex24.hh, ll24: ex24.ll
  };
}

/** First index where every indicator is defined. */
export const WARMUP = 600;
