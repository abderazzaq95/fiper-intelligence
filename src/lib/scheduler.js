import { cache } from './cache.js';
import { log } from './logger.js';
import { config } from '../config.js';
import { fetchCrypto } from '../providers/binance.js';
import { fetchFx } from '../providers/frankfurter.js';
import { fetchCot } from '../providers/cftc.js';
import { fetchQuotes } from '../providers/quotes.js';
import { fetchNews } from '../providers/news.js';
import { fetchCalendar } from '../providers/calendar.js';
import { interpretBatch } from '../services/interpret.js';
import { computeRisk } from '../services/risk.js';
import { computeBias } from '../services/bias.js';
import { refreshOanda, evaluateTrades } from '../services/autotrader.js';
import { broadcast } from '../ws/hub.js';

/**
 * One refresh loop for every connected client.
 *
 * This is the whole reason the backend exists: without it each browser
 * hits Binance and the CFTC directly, which rate-limits you at a few
 * dozen concurrent users and leaks CORS problems into the UI.
 */
export const TTL = {
  crypto: 60_000,
  quotes: 60_000,
  fx: 6 * 3600_000,
  cot: 12 * 3600_000,
  news: 10 * 60_000,
  calendar: 30 * 60_000,
  derived: 60_000
};

async function refreshFast() {
  const [crypto, quotes] = await Promise.all([fetchCrypto(), fetchQuotes()]);
  if (crypto) cache.set('crypto', crypto, TTL.crypto);
  if (quotes) cache.set('quotes', quotes, TTL.quotes);
  recompute();
  broadcast('prices', {
    crypto: cache.getStale('crypto') ?? [],
    quotes: cache.getStale('quotes') ?? []
  });
}

async function refreshSlow() {
  const [news, calendar] = await Promise.all([fetchNews(), fetchCalendar()]);

  if (news) {
    // Only interpret what we have not seen before — the cache in
    // interpret.js dedupes, but skipping the call entirely is cheaper.
    const enriched = await interpretBatch(news.slice(0, 20));
    cache.set('news', enriched, TTL.news);
    broadcast('news', enriched.slice(0, 10));
  }
  if (calendar) cache.set('calendar', calendar, TTL.calendar);
}

async function refreshDaily() {
  const [fx, cot] = await Promise.all([fetchFx(), fetchCot()]);
  if (fx)  cache.set('fx', fx, TTL.fx);
  if (cot) cache.set('cot', cot, TTL.cot);
  recompute();
}

/** Derived state — risk gauge and per-asset bias. Cheap, so recompute freely. */
export function recompute() {
  const crypto = cache.getStale('crypto') ?? [];
  const quotes = cache.getStale('quotes') ?? [];
  if (!crypto.length && !quotes.length) return;

  const risk = computeRisk({ quotes, crypto });
  cache.set('risk', risk, TTL.derived);

  const cot = cache.getStale('cot')?.markets ?? {};
  const dollar = quotes.find(q => q.symbol === 'DXY')?.change ?? 0;
  const all = [...quotes, ...crypto];

  const bias = {};
  for (const q of all) {
    const b = computeBias(q.symbol, { quote: q, risk, cot: cot[q.symbol], dollarChange: dollar });
    if (b) bias[q.symbol] = b;
  }
  cache.set('bias', bias, TTL.derived);
  broadcast('derived', { risk, bias });
}

export async function startScheduler() {
  log.info('warming cache…');
  await Promise.allSettled([refreshFast(), refreshDaily(), refreshOanda()]);
  await refreshSlow();
  log.ok('cache warm');

  setInterval(() => refreshFast().catch(e => log.error('fast', e.message)), config.refresh.fast);
  setInterval(() => refreshSlow().catch(e => log.error('slow', e.message)), config.refresh.slow);
  setInterval(() => refreshDaily().catch(e => log.error('daily', e.message)), config.refresh.daily);
  setInterval(() => refreshOanda().catch(e => log.error('oanda', e.message)), config.refresh.oanda);
  setInterval(() => evaluateTrades().catch(e => log.error('trade-eval', e.message)), config.refresh.tradeEval);
}
