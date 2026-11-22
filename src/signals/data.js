import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { get } from '../lib/http.js';
import { log } from '../lib/logger.js';
import { INSTRUMENTS } from './instruments.js';

/**
 * Hourly OHLC history for research and live scanning.
 *
 * Research and live use the same bars from the same source on purpose:
 * a model trained on one feed and fed another at runtime quietly loses
 * whatever edge it had.
 *
 * Hourly is the finest resolution with enough free history behind it —
 * Yahoo keeps ~2 years of 60m bars but only ~60 days of 15m, and 60 days
 * is far too little to measure a win rate honestly.
 */
const HOUR = 3600_000;
const DIR = new URL('../../data/history/', import.meta.url);
const CACHE_MAX_AGE = 6 * HOUR;

function clean(bars) {
  const byT = new Map();
  for (const b of bars) {
    if (![b.o, b.h, b.l, b.c].every(Number.isFinite)) continue;
    byT.set(b.t, b);
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

/** Drops the bar still forming — signals fire on closed bars only. */
export const closedOnly = (bars, now = Date.now()) => bars.filter(b => b.t + HOUR <= now);

async function yahoo(symbol, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=60m&range=${range}`;
  const body = await get(url, { timeout: 25_000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const r = body?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  if (!r?.timestamp || !q) return null;
  return r.timestamp.map((ts, i) => ({
    t: ts * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume?.[i] ?? 0
  }));
}

async function binance(symbol, { days, limitBars }) {
  const base = 'https://api.binance.com/api/v3/klines';
  if (limitBars) {
    const d = await get(`${base}?symbol=${symbol}&interval=1h&limit=${limitBars}`, { timeout: 20_000 });
    return Array.isArray(d) ? d.map(toBar) : null;
  }
  const out = [];
  let start = Date.now() - days * 24 * HOUR;
  while (start < Date.now()) {
    const d = await get(`${base}?symbol=${symbol}&interval=1h&limit=1000&startTime=${start}`, { timeout: 20_000 });
    if (!Array.isArray(d)) return out.length ? out : null;
    if (!d.length) break;
    out.push(...d.map(toBar));
    start = d[d.length - 1][0] + HOUR;
    if (d.length < 1000) break;
  }
  return out;
}
const toBar = k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] });

async function fetchFull(key) {
  const inst = INSTRUMENTS[key];
  const raw = inst.source === 'yahoo'
    ? await yahoo(inst.symbol, inst.range)
    : await binance(inst.symbol, { days: inst.days });
  return raw ? clean(raw) : null;
}

/** Long history for research, cached on disk so re-runs do not hammer the APIs. */
export async function loadHistory(key, { refresh = false } = {}) {
  await mkdir(DIR, { recursive: true });
  const file = new URL(`${key}-1h.json`, DIR);
  if (!refresh) {
    try {
      const s = await stat(file);
      if (Date.now() - s.mtimeMs < CACHE_MAX_AGE) return JSON.parse(await readFile(file, 'utf8'));
    } catch { /* no cache yet */ }
  }
  const bars = await fetchFull(key);
  if (!bars?.length) {
    log.warn(`history: ${key} fetch failed, trying stale cache`);
    try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
  }
  await writeFile(file, JSON.stringify(bars));
  return bars;
}

/**
 * Recent bars for the live scanner — enough warm-up for the 200-period
 * EMA and the volatility rank, nothing more.
 */
export async function loadRecent(key) {
  const inst = INSTRUMENTS[key];
  const raw = inst.source === 'yahoo'
    ? await yahoo(inst.symbol, '3mo')
    : await binance(inst.symbol, { limitBars: 1000 });
  return raw ? closedOnly(clean(raw)) : null;
}
