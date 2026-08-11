import { get } from '../lib/http.js';
import { config } from '../config.js';

/**
 * Indices, commodities and the dollar index.
 * No free keyless source exists for these, so this returns null until
 * TWELVEDATA_KEY is set — the route reports `enabled: false` rather than
 * inventing numbers.
 */
const SYMBOLS = {
  'NDX':     { display: 'NQUSD',  name: 'Nasdaq 100' },
  'SPX':     { display: 'ESUSD',  name: 'S&P 500' },
  'DJI':     { display: 'YMUSD',  name: 'Dow 30' },
  'DAX':     { display: 'DAX',    name: 'DAX 40' },
  'XAU/USD': { display: 'XAUUSD', name: 'Gold' },
  'XAG/USD': { display: 'XAGUSD', name: 'Silver' },
  'WTI/USD': { display: 'USOIL',  name: 'WTI Crude' },
  'DXY':     { display: 'DXY',    name: 'Dollar Index' }
};

export async function fetchQuotes() {
  if (!config.keys.twelvedata) return null;

  const symbols = Object.keys(SYMBOLS).join(',');
  const data = await get(
    `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${config.keys.twelvedata}`
  );
  if (!data) return null;

  const rows = data.symbol ? { [data.symbol]: data } : data;
  const out = [];

  for (const [key, meta] of Object.entries(SYMBOLS)) {
    const q = rows[key];
    if (!q || q.status === 'error') continue;
    out.push({
      symbol: meta.display,
      name: meta.name,
      source: 'twelvedata',
      price:  +q.close,
      change: +q.percent_change,
      high:   +q.high,
      low:    +q.low,
      at: Date.now()
    });
  }
  return out.length ? out : null;
}
