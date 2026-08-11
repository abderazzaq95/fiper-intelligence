import { get } from '../lib/http.js';
import { config } from '../config.js';

const BASE = 'https://api.binance.com/api/v3';
const toDisplay = s => s.replace(/USDT$/, 'USD');

/** Live spot prices + 24h stats. Keyless. */
export async function fetchCrypto() {
  const symbols = JSON.stringify(config.universe.crypto);
  const data = await get(`${BASE}/ticker/24hr?symbols=${encodeURIComponent(symbols)}`);
  if (!Array.isArray(data)) return null;

  return data.map(t => ({
    symbol: toDisplay(t.symbol),
    source: 'binance',
    price:  +t.lastPrice,
    change: +t.priceChangePercent,
    high:   +t.highPrice,
    low:    +t.lowPrice,
    volume: +t.quoteVolume,
    at: Date.now()
  }));
}

/** OHLC candles for the candle-analysis screen. Keyless. */
export async function fetchKlines(symbol, interval = '1h', limit = 100) {
  const sym = symbol.endsWith('USDT') ? symbol : symbol.replace(/USD$/, 'USDT');
  const data = await get(`${BASE}/klines?symbol=${sym}&interval=${interval}&limit=${limit}`);
  if (!Array.isArray(data)) return null;

  return data.map(k => ({
    t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5]
  }));
}
