import { get } from '../lib/http.js';
import { config } from '../config.js';

/**
 * ECB reference rates. Keyless, but published once per working day —
 * treat this as a daily anchor, not a live tick.
 */
export async function fetchFx() {
  const to = config.universe.fx.join(',');
  const data = await get(`https://api.frankfurter.app/latest?from=USD&to=${to}`);
  if (!data?.rates) return null;

  return { base: 'USD', date: data.date, rates: data.rates, source: 'frankfurter', at: Date.now() };
}

/** Historical series, used to derive currency strength over a window. */
export async function fetchFxSeries(days = 30) {
  const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const to = config.universe.fx.join(',');
  const data = await get(`https://api.frankfurter.app/${from}..?from=USD&to=${to}`);
  return data?.rates ?? null;
}
