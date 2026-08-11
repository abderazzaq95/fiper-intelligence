/* Non-crypto OHLC for CandlesScreen's Patterns Detected/Multi-Timeframe
   Trend/"Why This Candle Formed" panels. These historically only ran on
   Binance data (crypto only) — this extends the same real-data-driven
   analysis to indices/commodities/FX via Yahoo Finance, proxied through
   the backend's new GET /api/klines-external/:symbol (Yahoo's chart API
   has no CORS allowance for browser callers, confirmed empirically — a
   direct fetch() from the app fails, curl from the server succeeds —
   so unlike a plain "fetch a public API" case this genuinely needs the
   backend in the loop, same as candles.ts's Binance path already is).

   Kept as its own file rather than added to candles.ts/tradingview.ts:
   candles.ts's own header comment frames it as strictly the
   Binance-backed path ("the browser never talks to Binance directly"),
   and tradingview.ts is purely a chart-symbol lookup, unrelated to
   fetching OHLC for the analysis panels. */

import { createClient } from './apiClient';
import type { Kline } from './candles';

const api = createClient();

// App asset key -> Yahoo Finance ticker, per spec.
export const YAHOO_SYMBOL_MAP: Record<string, string> = {
  XAUUSD: 'GC=F',
  USOIL: 'CL=F',
  NQUSD: 'NQ=F',
  ESUSD: 'ES=F',
  DXY: 'DX-Y.NYB',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'USDJPY=X',
};

// Same 8s timeout guard as candles.ts's fetchKlines, for the same
// reason: api.klines()'s underlying fetch() has no timeout of its own,
// and CandlesScreen fires several of these concurrently (main + all of
// TFS for Multi-Timeframe Trend) whenever an asset is selected.
const KLINES_TIMEOUT_MS = 8000;

export async function fetchExternalKlines(asset: string, tf: string, limit = 80): Promise<Kline[] | null> {
  const symbol = YAHOO_SYMBOL_MAP[asset];
  if (!symbol) return null;

  const res = await Promise.race([
    api.klinesExternal(symbol, tf, limit),
    new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), KLINES_TIMEOUT_MS)),
  ]);
  if (!res.data || !res.data.length) return null;
  return res.data.map((k: any) => ({ t: k.t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v }));
}
