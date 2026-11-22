import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { get } from '../lib/http.js';
import { log } from '../lib/logger.js';
import { rsi, atr } from './indicators.js';
import { wilsonLower } from './model.js';
import { monteCarlo } from './backtest.js';

/**
 * "Dip in an uptrend" — the daily swing playbook, and the engine's core.
 *
 * Buy a sharp short-term pullback (2-period RSI below 10) while price is
 * above its 200-day average; exit on the first close back above the
 * 5-day average. It is one of the most-replicated high-win-rate edges in
 * public research on equity indices (Connors & Alvarez), and it held up
 * on our own data in both 2000–2018 and 2019–2026.
 *
 * The rules are fixed in advance at the published defaults, NOT tuned
 * here: there is no parameter search, so there is nothing for the
 * backtest to overfit. The one addition is a protective stop at 3 ATR —
 * the textbook version has none, and on a small leveraged account a
 * single unstopped −30% trade (BTC, 2018) is the end of the account.
 *
 * Longs only. The short mirror is weak on these instruments because
 * they drift up over time.
 */
export const RULES = {
  trendLen: 200,
  rsiLen: 2,
  rsiEntry: 10,
  exitLen: 5,
  maxDays: 10,
  stopAtr: 3
};

/**
 * Daily feeds. Long history is the point: 26 years for Nasdaq and gold
 * gives hundreds of trades, which is what lets a win rate be quoted at
 * all. `swapPerDay` is a rough overnight financing charge (fraction of
 * price, per night held) — Exness charges swaps on positions held past
 * the daily rollover, and a multi-day playbook must pay them.
 */
export const SWING_INSTRUMENTS = {
  USTEC:  { name: 'Nasdaq 100', source: 'yahoo', symbol: 'NQ=F', costPct: 0.00025, swapPerDay: 0.0002, contract: 1 },
  XAUUSD: { name: 'Gold',       source: 'yahoo', symbol: 'GC=F', costPct: 0.00025, swapPerDay: 0.0002, contract: 100 },
  BTCUSD: { name: 'Bitcoin',    source: 'binance', symbol: 'BTCUSDT', costPct: 0.0008, swapPerDay: 0.0006, contract: 1 }
};

const DAY = 864e5;
const DIR = new URL('../../data/history/', import.meta.url);

/* ---------- data ---------- */

async function yahooDaily(symbol, fromSec) {
  // range=max silently downgrades to 3-month bars — explicit periods keep it daily
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${fromSec}&period2=${Math.floor(Date.now() / 1000)}`;
  const b = await get(url, { timeout: 30_000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const r = b?.chart?.result?.[0], q = r?.indicators?.quote?.[0];
  if (!r?.timestamp || !q) return null;
  const tz = r.meta?.exchangeTimezoneName || 'America/New_York';
  return r.timestamp.map((t, i) => ({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], tz }))
    .filter(k => [k.o, k.h, k.l, k.c].every(Number.isFinite));
}

async function binanceDaily(symbol) {
  const out = [];
  let start = Date.parse('2017-08-17');
  while (start < Date.now()) {
    const d = await get(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=1000&startTime=${start}`, { timeout: 20_000 });
    if (!Array.isArray(d) || !d.length) break;
    out.push(...d.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], closeT: k[6] })));
    start = d.at(-1)[0] + DAY;
    if (d.length < 1000) break;
  }
  return out.length ? out : null;
}

/** Calendar date + hour of a timestamp in an exchange's timezone. */
function zoned(t, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour };
}

/**
 * Keeps only finished daily bars. CME futures settle at 17:00 New York
 * time; Yahoo's bar for date D is final once New York has passed 17:00
 * on D. Binance days close at 00:00 UTC and say so in the payload.
 * Signals on an unfinished bar would repaint — the classic way a
 * live system fails to match its backtest.
 */
export function completedDaily(bars, now = Date.now()) {
  return bars.filter(b => {
    if (b.closeT) return b.closeT < now;
    const tz = b.tz || 'America/New_York';
    const bar = zoned(b.t, tz).date, cur = zoned(now, tz);
    return bar < cur.date || (bar === cur.date && cur.hour >= 17);
  });
}

export async function loadDaily(key, { maxAgeMs = 3 * 3600_000 } = {}) {
  const inst = SWING_INSTRUMENTS[key];
  await mkdir(DIR, { recursive: true });
  const file = new URL(`${key}-1d.json`, DIR);
  try {
    const s = await stat(file);
    if (Date.now() - s.mtimeMs < maxAgeMs) return JSON.parse(await readFile(file, 'utf8'));
  } catch { /* first run */ }
  const bars = inst.source === 'yahoo' ? await yahooDaily(inst.symbol, 946684800) : await binanceDaily(inst.symbol);
  if (!bars?.length) {
    log.warn(`daily: ${key} fetch failed, using stale cache if any`);
    try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
  }
  await writeFile(file, JSON.stringify(bars));
  return bars;
}

/* ---------- indicators & rules ---------- */

const sma = (a, p) => {
  const out = new Array(a.length).fill(NaN); let s = 0;
  for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= p) s -= a[i - p]; if (i >= p - 1) out[i] = s / p; }
  return out;
};

export function swingIndicators(bars) {
  const c = bars.map(b => b.c);
  return { c, trend: sma(c, RULES.trendLen), exit: sma(c, RULES.exitLen), rsi: rsi(c, RULES.rsiLen), atr: atr(bars, 14) };
}

/** Is the bar at i a dip-buy signal? Returns context for the alert, or null. */
export function swingSignalAt(bars, x, i) {
  if (i < RULES.trendLen || !(x.c[i] > x.trend[i]) || !(x.rsi[i] < RULES.rsiEntry)) return null;
  let downDays = 0;
  for (let k = i; k > 0 && x.c[k] < x.c[k - 1]; k--) downDays++;
  return {
    rsi: x.rsi[i], atr: x.atr[i], close: x.c[i],
    trendGapPct: (x.c[i] / x.trend[i] - 1) * 100,
    exitLevel: x.exit[i], downDays
  };
}

/**
 * The exit price that would trigger today's "close back above the 5-day
 * average" — computed for tomorrow's 5-day window so the alert can say
 * "take profit on a close above X" in plain numbers.
 */
export function nextExitLevel(closes) {
  const last4 = closes.slice(-(RULES.exitLen - 1));
  // close > (sum(last4) + close) / 5  ⇔  close > sum(last4) / 4
  return last4.reduce((s, v) => s + v, 0) / last4.length;
}

/** Dip depth buckets — deeper dips have historically bounced more reliably. */
export const RSI_BUCKETS = [[0, 3], [3, 6], [6, RULES.rsiEntry]];
export const bucketOf = r => RSI_BUCKETS.findIndex(([lo, hi]) => r >= lo && r < hi);

/* ---------- backtest ---------- */

export function backtestSwing(bars, inst) {
  const x = swingIndicators(bars);
  const trades = [];
  let i = RULES.trendLen;
  while (i < bars.length - 1) {
    const sig = swingSignalAt(bars, x, i);
    if (!sig) { i++; continue; }
    const entry = bars[i + 1].o;
    const stop = entry - RULES.stopAtr * x.atr[i];
    let exit = null, how = null, j = i + 1;
    for (; j < bars.length && j <= i + RULES.maxDays; j++) {
      const b = bars[j];
      if (b.l <= stop) { exit = Math.min(b.o, stop); how = 'STOP'; break; }
      if (x.c[j] > x.exit[j]) { exit = b.c; how = 'TARGET'; break; }
    }
    if (exit == null) {
      if (j >= bars.length) break; // still open at the end of data — not a result yet
      j = Math.min(i + RULES.maxDays, bars.length - 1); exit = bars[j].c; how = 'TIME';
    }
    const nights = Math.max(1, j - (i + 1));
    const ret = (exit - entry) / entry - inst.costPct - inst.swapPerDay * nights;
    const riskPct = (entry - stop) / entry;
    trades.push({ t: bars[i].t, i, j, entry, exit, how, ret, R: ret / riskPct, win: ret > 0 ? 1 : 0, rsi: sig.rsi, nights });
    i = j + 1;
  }
  return trades;
}

function summarize(ts) {
  const n = ts.length, wins = ts.filter(t => t.win).length;
  const gross = ts.filter(t => t.R > 0).reduce((s, t) => s + t.R, 0);
  const loss = -ts.filter(t => t.R < 0).reduce((s, t) => s + t.R, 0);
  let eq = 0, peak = 0, dd = 0;
  for (const t of ts) { eq += t.R; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
  return {
    n, wins,
    winRate: n ? wins / n : 0,
    winRateLow95: wilsonLower(wins, n),
    expectancyR: n ? ts.reduce((s, t) => s + t.R, 0) / n : 0,
    avgReturnPct: n ? ts.reduce((s, t) => s + t.ret, 0) / n * 100 : 0,
    profitFactor: loss ? gross / loss : (gross ? Infinity : 0),
    stopOuts: ts.filter(t => t.how === 'STOP').length,
    avgNights: n ? ts.reduce((s, t) => s + t.nights, 0) / n : 0,
    maxDrawdownR: dd,
    worstR: n ? Math.min(...ts.map(t => t.R)) : 0
  };
}

/**
 * Research for the swing playbook: first 70% of trades in time is the
 * "development" sample, last 30% the holdout. With no parameters being
 * chosen, the split exists to show the edge is not a single-era
 * artefact. The per-bucket probabilities quoted in alerts come from ALL
 * history (more data, tighter bounds) and are quoted as the Wilson
 * lower bound, never the raw rate.
 */
export async function researchSwing(key) {
  const inst = SWING_INSTRUMENTS[key];
  const raw = await loadDaily(key, { maxAgeMs: 0 });
  if (!raw) return { key, enabled: false, reason: 'no data' };
  const bars = completedDaily(raw);
  const trades = backtestSwing(bars, inst);
  const cut = Math.floor(trades.length * 0.7);
  const dev = summarize(trades.slice(0, cut)), hold = summarize(trades.slice(cut));
  const all = summarize(trades);
  const enabled = dev.expectancyR > 0 && hold.expectancyR > 0 && hold.n >= 8;
  const buckets = RSI_BUCKETS.map(([lo, hi], b) => {
    const ts = trades.filter(t => bucketOf(t.rsi) === b);
    const w = ts.filter(t => t.win).length;
    return { rsiFrom: lo, rsiTo: hi, n: ts.length, winRate: ts.length ? w / ts.length : 0, winRateLow95: wilsonLower(w, ts.length) };
  });
  const years = (bars.at(-1).t - bars[RULES.trendLen].t) / (365 * DAY);
  return {
    key, playbook: 'swing', enabled,
    reason: enabled ? 'positive expectancy in development AND holdout' : 'edge did not hold in both periods',
    rules: RULES, costs: { spreadPct: inst.costPct, swapPerNightPct: inst.swapPerDay },
    development: dev, holdout: hold, all, buckets,
    signalsPerMonth: Math.round(trades.length / (years * 12) * 100) / 100,
    flip: monteCarlo(trades.map(t => t.R), { riskPct: 2 }),
    flipAggressive: monteCarlo(trades.map(t => t.R), { riskPct: 5 }),
    split: { holdoutFrom: trades[cut]?.t ?? null },
    bars: { from: bars[0].t, to: bars.at(-1).t, count: bars.length },
    recent: trades.slice(-8).map(t => ({ date: new Date(t.t).toISOString().slice(0, 10), how: t.how, R: Math.round(t.R * 100) / 100, retPct: Math.round(t.ret * 10000) / 100 }))
  };
}
