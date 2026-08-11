import { get } from '../lib/http.js';
import { config } from '../config.js';

const IMPACT = { High: 'HIGH', Medium: 'MED', Low: 'LOW' };

/**
 * Economic calendar. FMP first, Trading Economics second.
 * Returns null when neither key is set.
 */
export async function fetchCalendar(daysAhead = 7, daysBack = 2) {
  if (config.keys.fmp) return fromFmp(daysAhead, daysBack);
  if (config.keys.te)  return fromTradingEconomics(daysAhead, daysBack);
  return null;
}

const iso = d => d.toISOString().slice(0, 10);

async function fromFmp(ahead, back) {
  const from = iso(new Date(Date.now() - back * 864e5));
  const to   = iso(new Date(Date.now() + ahead * 864e5));
  const data = await get(
    `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${config.keys.fmp}`
  );
  if (!Array.isArray(data)) return null;

  return data.map(e => ({
    id: `${e.date}-${e.event}`.replace(/\s+/g, '-'),
    time: new Date(e.date).getTime(),
    currency: e.currency,
    event: e.event,
    impact: IMPACT[e.impact] || 'LOW',
    previous: e.previous ?? null,
    forecast: e.estimate ?? null,
    actual: e.actual ?? null,
    unit: e.unit || '',
    released: e.actual != null,
    source: 'fmp'
  })).sort((a, b) => a.time - b.time);
}

async function fromTradingEconomics(ahead, back) {
  const from = iso(new Date(Date.now() - back * 864e5));
  const to   = iso(new Date(Date.now() + ahead * 864e5));
  const data = await get(
    `https://api.tradingeconomics.com/calendar/country/all/${from}/${to}?c=${config.keys.te}&f=json`
  );
  if (!Array.isArray(data)) return null;

  return data.map(e => ({
    id: String(e.CalendarId),
    time: new Date(e.Date).getTime(),
    currency: e.Currency,
    event: e.Event,
    impact: e.Importance === 3 ? 'HIGH' : e.Importance === 2 ? 'MED' : 'LOW',
    previous: e.Previous ?? null,
    forecast: e.Forecast ?? null,
    actual: e.Actual ?? null,
    unit: e.Unit || '',
    released: e.Actual != null && e.Actual !== '',
    source: 'trading-economics'
  })).sort((a, b) => a.time - b.time);
}
