/* Data layer for the "News on Chart" timeline on CandlesScreen (Phase 1
   of "what drove this move"). Deliberately NOT reusing
   MarketDataProvider's S.news: marketData.ts's loadNews() falls back to
   NEWS_SEED (fake demo headlines) whenever the backend has no news key
   configured, which is the right behaviour for the rest of the app
   (Live Headlines etc. should never look broken) but wrong here — this
   feature is specced to show an explicit "connect a feed" empty state
   in that case instead of fabricated pins, so it fetches independently
   and treats a null/empty response as "not configured" rather than
   seeding demo content. */

import { createClient } from './apiClient';
import type { NewsItem } from './marketData';

const api = createClient();

// Hours of news history to show, keyed by the same timeframe codes
// CandlesScreen already uses ('15m' | '1h' | '4h' | '1d').
export const TIMEFRAME_NEWS_HOURS: Record<string, number> = {
  '15m': 4,
  '1h': 24,
  '4h': 48,
  '1d': 24 * 7,
};

// Mirrors marketData.ts's adaptNewsRow() (not exported from there, and
// deliberately not imported/reused — keeping this feature's fetch path
// fully independent of the shared provider, per the above). Same
// backend row shape, same fallbacks.
function adaptRow(r: any): NewsItem {
  const ai = r.ai as { summary?: string; impact?: string; category?: string; impacts?: { symbol: string; direction: 'up' | 'down' }[] } | null;
  return {
    id: String(r.id),
    h: r.headline,
    s: ai?.summary || r.summary || '',
    full: r.summary || ai?.summary || '',
    t: ai?.impacts?.map((i) => `${i.symbol} ${i.direction === 'up' ? '↑' : '↓'}`) ?? [],
    imp: (ai?.impact as NewsItem['imp']) ?? 'MED',
    cat: (ai?.category as NewsItem['cat']) ?? 'macro',
    ts: r.publishedAt ?? Date.now(),
  };
}

/** Returns null when the backend has no news source configured (503 /
 *  empty payload, e.g. MARKETAUX_KEY and FINNHUB_KEY both unset) — the
 *  caller renders the "connect a feed" empty state rather than any
 *  fallback/seeded content. */
export async function fetchTimelineNews(): Promise<NewsItem[] | null> {
  const res = await api.news({ limit: '40' });
  if (!res.data || !res.data.length) return null;
  return res.data.map(adaptRow);
}
