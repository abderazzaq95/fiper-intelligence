import { get } from '../lib/http.js';
import { config } from '../config.js';

/**
 * Headlines. Two adapters, whichever key is present wins.
 *
 * LICENSING NOTE — read before going live.
 * Redistributing a wire's headlines to paying subscribers usually needs
 * a distribution licence, not just API access. Check the terms of
 * whichever provider you settle on. Marketaux and Finnhub aggregate
 * third-party publishers; that does not automatically grant you the
 * right to resell their content.
 */
export async function fetchNews(limit = 40) {
  if (config.keys.marketaux) return fromMarketaux(limit);
  if (config.keys.finnhub)   return fromFinnhub(limit);
  return null;
}

async function fromMarketaux(limit) {
  const url = `https://api.marketaux.com/v1/news/all?filter_entities=true&language=en`
    + `&limit=${Math.min(limit, 50)}&api_token=${config.keys.marketaux}`;
  const data = await get(url);
  if (!data?.data) return null;

  return data.data.map(a => ({
    id: a.uuid,
    headline: a.title,
    summary: a.description,
    url: a.url,
    publisher: a.source,
    publishedAt: new Date(a.published_at).getTime(),
    entities: (a.entities || []).map(e => e.symbol).filter(Boolean),
    source: 'marketaux'
  }));
}

async function fromFinnhub(limit) {
  const data = await get(`https://finnhub.io/api/v1/news?category=general&token=${config.keys.finnhub}`);
  if (!Array.isArray(data)) return null;

  return data.slice(0, limit).map(a => ({
    id: String(a.id),
    headline: a.headline,
    summary: a.summary,
    url: a.url,
    publisher: a.source,
    publishedAt: a.datetime * 1000,
    entities: a.related ? a.related.split(',').filter(Boolean) : [],
    source: 'finnhub'
  }));
}
