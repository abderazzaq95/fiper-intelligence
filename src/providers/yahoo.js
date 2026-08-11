import { get } from '../lib/http.js';

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

/* App timeframe -> Yahoo interval + how much history to request. Yahoo
   has no native 4h bar — '4h' is synthesized by aggregating four
   consecutive 60m bars into one (open=first, close=last, high=max,
   low=min, volume=sum), so it shares the 60m/3mo source with '1h'.
   Ranges are chosen against Yahoo's real intraday-history limits (1m
   data is only available for the last ~7 days, sub-hour intervals for
   ~60 days), generous enough that a `limit`-sized slice of the most
   recent bars is always available after fetching. */
const SOURCE = {
  '1m':  { interval: '1m',  range: '5d' },
  '5m':  { interval: '5m',  range: '1mo' },
  '15m': { interval: '15m', range: '1mo' },
  '1h':  { interval: '60m', range: '3mo' },
  '4h':  { interval: '60m', range: '3mo' }, // aggregated below
  '1d':  { interval: '1d',  range: '1y' }
};

function parseChart(body) {
  const result = body?.chart?.result?.[0];
  if (!result) return null;
  const ts = result.timestamp;
  const q = result.indicators?.quote?.[0];
  if (!Array.isArray(ts) || !q) return null;

  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue; // Yahoo nulls out halts/gaps rather than omitting the slot
    out.push({ t: ts[i] * 1000, o, h, l, c, v: q.volume?.[i] ?? 0 });
  }
  return out;
}

/** Groups consecutive 1h bars into 4h bars. Drops a trailing partial
 *  group smaller than 4 bars rather than emit a mislabeled short candle. */
function aggregate4h(hourly) {
  const out = [];
  for (let i = 0; i + 4 <= hourly.length; i += 4) {
    const g = hourly.slice(i, i + 4);
    out.push({
      t: g[0].t,
      o: g[0].o,
      c: g[g.length - 1].c,
      h: Math.max(...g.map(k => k.h)),
      l: Math.min(...g.map(k => k.l)),
      v: g.reduce((a, k) => a + k.v, 0)
    });
  }
  return out;
}

/** OHLC for non-crypto assets (indices/commodities/FX), proxied so the
 *  browser never talks to Yahoo directly (query1.finance.yahoo.com has
 *  no CORS allowance for third-party origins — confirmed: reachable
 *  server-side, rejected in-browser). `symbol` is already Yahoo's own
 *  ticker (GC=F, EURUSD=X, ...) — that mapping lives frontend-side in
 *  web/lib/terminal/yahooFinance.ts, mirroring how CNDL_ASSETS maps to
 *  Binance tickers before calling /api/klines. */
export async function fetchExternalKlines(symbol, tf = '1h', limit = 80) {
  const src = SOURCE[tf];
  if (!src) return null;

  const url = `${BASE}/${encodeURIComponent(symbol)}?interval=${src.interval}&range=${src.range}`;
  const body = await get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const parsed = parseChart(body);
  if (!parsed) return null;

  const candles = tf === '4h' ? aggregate4h(parsed) : parsed;
  return candles.slice(-limit);
}
