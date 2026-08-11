/* ══════════════════════════════════════════════════════════════
   Candle Analysis runs on REAL OHLC, proxied through the backend's
   /api/klines/:symbol (src/routes/index.js: "Candles proxied so the
   browser never talks to Binance directly") instead of hitting Binance
   from the browser. Pattern detection is a real algorithm computed on
   that data (body/wick ratios), not a lookup table — ported verbatim
   from fiper-terminal.html.

   drawCandles() in the original builds an SVG string via template
   literals. Ported here as computeCandleGeometry(), a pure function that
   returns plain geometry data; CandlesScreen.tsx renders that as JSX
   <svg> elements instead of building markup imperatively (same numbers,
   same layout — just JSX instead of a template string).
══════════════════════════════════════════════════════════════ */

import { between } from './rng';
import { num } from './format';
import { createClient } from './apiClient';

const api = createClient();

export interface Kline {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export const CNDL_ASSETS: Record<string, string> = { BTCUSD: 'BTCUSDT', ETHUSD: 'ETHUSDT', SOLUSD: 'SOLUSDT', XRPUSD: 'XRPUSDT' };
export const TFS: [string, string][] = [['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['1h', '1H'], ['4h', '4H'], ['1d', '1D']];

// Every asset the chart selector on CandlesScreen can show, grouped for
// display. Only the 'crypto' group's assets are keys of CNDL_ASSETS
// above (Binance-backed, so real pattern detection/multi-timeframe
// trend/"why formed" can run on them) — the rest drive the TradingView
// chart only (via tvSymbol() in tradingview.ts, not duplicated here).
// CandlesScreen checks CNDL_ASSETS membership to decide whether to
// attempt the Binance-kline fetch for a given selection.
export const CHART_ASSET_GROUPS: readonly { key: 'crypto' | 'commodities' | 'indices' | 'forex'; assets: readonly string[] }[] = [
  { key: 'crypto', assets: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'] },
  { key: 'commodities', assets: ['XAUUSD', 'USOIL'] },
  { key: 'indices', assets: ['NQUSD', 'ESUSD'] },
  { key: 'forex', assets: ['DXY', 'EURUSD', 'GBPUSD', 'USDJPY'] },
] as const;

// api.klines()'s underlying fetch() has no timeout of its own — a stalled
// connection (backend under load, a slow upstream, a dropped response)
// would otherwise hang this call forever. Since CandlesScreen fires 5 of
// these concurrently (the main chart timeframe + all 4 multi-timeframe
// fetches) whenever the Candle Analysis screen is opened, one stuck
// request used to be enough to leave the whole Multi-Timeframe Trend
// panel — and its Promise.all — waiting indefinitely, rendering as
// permanently empty with no error and no way to recover short of
// switching asset/timeframe. Racing against a timeout guarantees this
// resolves to `null` (the same signal a real failure already produces),
// which callers already fall back from via `|| seedKlines(...)`.
const KLINES_TIMEOUT_MS = 8000;

export async function fetchKlines(sym: string, tf: string, limit = 80): Promise<Kline[] | null> {
  const res = await Promise.race([
    api.klines(sym, tf, limit),
    new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), KLINES_TIMEOUT_MS)),
  ]);
  if (!res.data || !res.data.length) return null;
  return res.data.map((k: any) => ({ t: k.t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v }));
}

export function seedKlines(limit = 80): Kline[] {
  let px = 71000;
  const out: Kline[] = [];
  for (let i = 0; i < limit; i++) {
    const o = px;
    const drift = between(-0.011, 0.012);
    const c = o * (1 + drift);
    const h = Math.max(o, c) * (1 + between(0, 0.006));
    const l = Math.min(o, c) * (1 - between(0, 0.006));
    out.push({ t: Date.now() - (limit - i) * 36e5, o, h, l, c, v: between(80, 400) });
    px = c;
  }
  return out;
}

/* ─── real candlestick pattern detection ─── */
export interface Pattern {
  n: string;
  d: string;
  bias: 'bull' | 'bear' | 'neutral';
  str: 'Strong' | 'Moderate';
}

export function detectPattern(c: Kline, prev: Kline | null | undefined): Pattern | null {
  const body = Math.abs(c.c - c.o);
  const range = c.h - c.l;
  if (range <= 0) return null;
  const bodyPct = body / range;
  const upper = c.h - Math.max(c.o, c.c);
  const lower = Math.min(c.o, c.c) - c.l;
  const bull = c.c > c.o;

  if (bodyPct < 0.09)
    return { n: 'Doji', d: 'Open and close are nearly equal — buyers and sellers finished the period in balance. On its own it signals indecision; it matters most when it appears after an extended run.', bias: 'neutral', str: 'Moderate' };
  if (lower > body * 2 && upper < body * 0.7 && bodyPct < 0.42)
    return bull
      ? { n: 'Hammer', d: 'Price was pushed well below the open then bought back before the close. Sellers tried and failed to hold the lows.', bias: 'bull', str: 'Strong' }
      : { n: 'Hanging Man', d: 'Same long lower wick as a hammer, but forming into strength. Buyers had to defend a sharp intraperiod drop.', bias: 'bear', str: 'Moderate' };
  if (upper > body * 2 && lower < body * 0.7 && bodyPct < 0.42)
    return bull
      ? { n: 'Inverted Hammer', d: 'Buyers drove price high but could not hold it. In a downtrend this often precedes a reversal attempt.', bias: 'bull', str: 'Moderate' }
      : { n: 'Shooting Star', d: 'A rally into the period was completely rejected before the close. Supply is sitting above.', bias: 'bear', str: 'Strong' };
  if (prev) {
    const pBody = Math.abs(prev.c - prev.o);
    const pBull = prev.c > prev.o;
    if (bull && !pBull && c.c >= prev.o && c.o <= prev.c && body > pBody * 1.1)
      return { n: 'Bullish Engulfing', d: 'This candle fully covers the prior down candle. Demand overwhelmed the previous period of selling.', bias: 'bull', str: 'Strong' };
    if (!bull && pBull && c.o >= prev.c && c.c <= prev.o && body > pBody * 1.1)
      return { n: 'Bearish Engulfing', d: 'This candle fully covers the prior up candle. Supply overwhelmed the previous period of buying.', bias: 'bear', str: 'Strong' };
    if (bull && !pBull && c.c > (prev.o + prev.c) / 2 && c.o < prev.c)
      return { n: 'Piercing Line', d: 'Opened below the prior close but recovered past its midpoint. Partial reversal of the previous move.', bias: 'bull', str: 'Moderate' };
    if (!bull && pBull && c.c < (prev.o + prev.c) / 2 && c.o > prev.c)
      return { n: 'Dark Cloud Cover', d: 'Opened above the prior close then gave back more than half of it. Momentum stalling.', bias: 'bear', str: 'Moderate' };
  }
  if (bodyPct > 0.9)
    return bull
      ? { n: 'Bullish Marubozu', d: 'Almost no wicks — price opened at the low and closed at the high. One-directional conviction.', bias: 'bull', str: 'Strong' }
      : { n: 'Bearish Marubozu', d: 'Almost no wicks — price opened at the high and closed at the low. One-directional conviction.', bias: 'bear', str: 'Strong' };
  return null;
}

/* ─── candle geometry (pure — CandlesScreen renders this as JSX <svg>) ─── */
export interface CandleBar {
  x: number;
  wickY1: number;
  wickY2: number;
  bodyX: number;
  bodyY: number;
  bodyW: number;
  bodyH: number;
  color: string;
}
export interface GridLine {
  y: number;
  label: string;
}
export interface TimeLabel {
  x: number;
  label: string;
}
export interface CandleGeometry {
  width: number;
  height: number;
  plotWidth: number;
  bars: CandleBar[];
  gridLines: GridLine[];
  timeLabels: TimeLabel[];
  lastPrice: { y: number; color: string; label: string };
}

export function computeCandleGeometry(data: Kline[], tf: string, w = 880, h = 340): CandleGeometry | null {
  if (!data.length) return null;
  const pad = { r: 64, b: 22, t: 10 };
  const pw = w - pad.r;
  const ph = h - pad.b - pad.t;
  const hi = Math.max(...data.map((d) => d.h));
  const lo = Math.min(...data.map((d) => d.l));
  const rng = hi - lo || 1;
  const y = (v: number) => pad.t + ((hi - v) / rng) * ph;
  const step = pw / data.length;
  const cw = Math.max(1.6, step * 0.62);
  const last = data[data.length - 1];

  const bars: CandleBar[] = data.map((d, i) => {
    const x = i * step + step / 2;
    const up = d.c >= d.o;
    const color = up ? '#00D084' : '#FF5470';
    const bt = y(Math.max(d.o, d.c));
    const bb = y(Math.min(d.o, d.c));
    return { x, wickY1: y(d.h), wickY2: y(d.l), bodyX: x - cw / 2, bodyY: bt, bodyW: cw, bodyH: Math.max(1, bb - bt), color };
  });

  const ticks = 5;
  const gridLines: GridLine[] = [];
  for (let i = 0; i <= ticks; i++) {
    const v = lo + (rng * i) / ticks;
    gridLines.push({ y: y(v), label: num(v, v > 1000 ? 0 : 2) });
  }
  const lc = last.c >= last.o ? '#00D084' : '#FF5470';
  const idxs = [0, Math.floor(data.length / 3), Math.floor((data.length * 2) / 3), data.length - 1];
  const timeLabels: TimeLabel[] = idxs.map((i) => {
    const d = new Date(data[i].t);
    const label =
      tf === '1d'
        ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return { x: i * step + step / 2, label };
  });

  return {
    width: w,
    height: h,
    plotWidth: pw,
    bars,
    gridLines,
    timeLabels,
    lastPrice: { y: y(last.c), color: lc, label: num(last.c, last.c > 1000 ? 0 : 2) },
  };
}
