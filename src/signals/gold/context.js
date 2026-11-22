import { dailyBars, LONDON, NEWYORK } from './m1.js';

/**
 * Everything the gold strategies read, computed once: per-minute local
 * clocks (London, New York), gold trading days, and the PREVIOUS day's
 * range and volatility for each day (never the current day's — that
 * would be look-ahead).
 */
export function buildContext(m) {
  const lonMin = new Int16Array(m.n), nyMin = new Int16Array(m.n);
  const offs = new Map();
  const offset = (tSec, tz) => {
    const key = tz + Math.floor(tSec / 86400);
    let o = offs.get(key);
    if (o === undefined) {
      const d = new Date((Math.floor(tSec / 86400) * 86400 + 43200) * 1000);
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        .formatToParts(d).map(x => [x.type, +x.value]));
      o = (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - d.getTime()) / 1000;
      offs.set(key, o);
    }
    return o;
  };
  // Gold's day opens at 17:00 New York (~22:00 London), i.e. the evening
  // BEFORE the calendar day. Those evening minutes get negative clock
  // values, so within one gold day the clock always increases and
  // "London 07:00–10:00" can never match the previous evening.
  for (let i = 0; i < m.n; i++) {
    const t = m.t[i];
    const lon = Math.floor(((t + offset(t, LONDON)) % 86400) / 60);
    const ny = Math.floor(((t + offset(t, NEWYORK)) % 86400) / 60);
    lonMin[i] = lon >= 20 * 60 + 30 ? lon - 1440 : lon;
    nyMin[i] = ny >= 17 * 60 ? ny - 1440 : ny;
  }

  const d = dailyBars(m);
  // Wilder ATR(14) on gold days; atrPrev[k] = ATR known at the START of day k
  const atrPrev = new Float64Array(d.n).fill(NaN), ema20Prev = new Float64Array(d.n).fill(NaN);
  let atr = NaN, ema = NaN;
  for (let k = 0; k < d.n; k++) {
    atrPrev[k] = atr; ema20Prev[k] = ema;
    const tr = k === 0 ? d.h[k] - d.l[k] : Math.max(d.h[k] - d.l[k], Math.abs(d.h[k] - d.c[k - 1]), Math.abs(d.l[k] - d.c[k - 1]));
    atr = k < 14 ? (k === 0 ? tr : (atr * k + tr) / (k + 1)) : (atr * 13 + tr) / 14;
    ema = k === 0 ? d.c[k] : ema + (2 / 21) * (d.c[k] - ema);
  }
  return { m, d, lonMin, nyMin, atrPrev, ema20Prev };
}

/** Year of a minute index (UTC) — used for per-year reporting and splits. */
export const yearOf = tSec => new Date(tSec * 1000).getUTCFullYear();
