/* ══════════════════════════════════════════════════════════════
   Backend-wired data layer. Every loadX(S, api) now tries the Node
   backend (src/ at repo root, via apiClient.ts) first; on failure —
   network error, backend down, or a 503 because the category needs a
   key that isn't configured server-side (quotes/news/calendar) — it
   falls back to the same local deterministic-PRNG "modelled" generator
   this file has always had. Same fail-soft-to-modelled UX as before,
   just one hop later: browser -> backend -> (provider | local model)
   instead of browser -> (provider | local model) directly.

   PRNG call order still matters (see rng.ts) for whichever seed*()
   functions actually fire — MarketDataProvider preserves the original
   relative order (quotes -> news -> calendar -> [crypto, fx, cot]).
══════════════════════════════════════════════════════════════ */

import { CONFIG } from './config';
import { between, rnd } from './rng';
import type { ApiClient } from './apiClient';

export type SrcMode = 'live' | 'stale' | 'demo' | 'wait';

/** live if the backend served fresh data, stale if it served expired
 *  cache rather than nothing (CLAUDE.md: "stale beats empty"). */
const modeFor = (stale?: boolean): SrcMode => (stale ? 'stale' : 'live');

export interface CryptoQuote {
  sym: string;
  price: number;
  chg: number;
  high: number;
  low: number;
  vol: number;
  name?: string;
  hist?: number[];
}

export interface Quote {
  sym: string;
  name: string;
  base: number;
  cls: string;
  price: number;
  chg: number;
  hist: number[];
}

export interface CotRow {
  date: string;
  specLong: number;
  specShort: number;
  commLong: number;
  commShort: number;
  oi: number;
}

export interface NewsItem {
  id: string;
  h: string;
  s: string;
  full: string;
  t: string[];
  imp: 'HIGH' | 'MED' | 'LOW';
  cat: 'forex' | 'indices' | 'commodities' | 'crypto' | 'macro';
  ts: number;
  read?: boolean;
}

export interface EventItem {
  ccy: string;
  n: string;
  t: string;
  imp: 'HIGH' | 'MED' | 'LOW';
  prev: number | null;
  fc: number | null;
  act: number | null;
  lo: number | null;
  hi: number | null;
  unit: string;
  day: number;
  date: Date;
  released: boolean;
}

export interface Theme {
  n: string;
  v: number;
  c: string;
}

export interface MarketState {
  crypto: Record<string, CryptoQuote>;
  fx: { base: string; date: string; rates: Record<string, number> };
  cot: Record<string, CotRow[]>;
  news: NewsItem[];
  events: EventItem[];
  quotes: Record<string, Quote>;
  risk: number;
  themes: Theme[];
  srcs: Record<string, SrcMode>;
}

export function createMarketState(): MarketState {
  return {
    crypto: {},
    fx: { base: 'USD', date: '—', rates: {} },
    cot: {},
    news: [],
    events: [],
    quotes: {},
    risk: 52,
    themes: [],
    srcs: {},
  };
}

export function setSrcMode(S: MarketState, key: string, mode: SrcMode): void {
  S.srcs[key] = mode;
}

/* ══════════ CRYPTO — live via Binance (backend-proxied), keyless ══════════ */
export const CRYPTO_MAP: Record<string, string> = {
  BTCUSDT: 'BTCUSD', ETHUSDT: 'ETHUSD', SOLUSDT: 'SOLUSD', XRPUSDT: 'XRPUSD', BNBUSDT: 'BNBUSD', ADAUSDT: 'ADAUSD',
};

/** Applies a backend /api/crypto (or WS 'prices'.crypto) payload in place. */
export function applyCrypto(S: MarketState, rows: any[]): void {
  rows.forEach((r) => {
    S.crypto[r.symbol] = { sym: r.symbol, price: r.price, chg: r.change, high: r.high, low: r.low, vol: r.volume };
  });
}

export async function loadCrypto(S: MarketState, api: ApiClient): Promise<boolean> {
  const res = await api.crypto();
  if (res.data && res.data.length) {
    applyCrypto(S, res.data);
    S.srcs.crypto = modeFor(res.stale);
    return true;
  }
  S.srcs.crypto = 'demo';
  seedCrypto(S);
  return false;
}
function seedCrypto(S: MarketState): void {
  const base: Record<string, number> = { BTCUSD: 71208, ETHUSD: 3842, SOLUSD: 188.4, XRPUSD: 2.41, BNBUSD: 712, ADAUSD: 0.94 };
  for (const k in base) {
    const c = between(-3.4, 3.9);
    S.crypto[k] = { sym: k, price: base[k] * (1 + c / 100), chg: c, high: base[k] * 1.02, low: base[k] * 0.98, vol: base[k] * 1e6 };
  }
}

/* ══════════ FX — ECB reference rates (backend-proxied), keyless, daily ══════════ */
export async function loadFx(S: MarketState, api: ApiClient): Promise<boolean> {
  const res = await api.fx();
  if (res.data) {
    S.fx = { base: res.data.base, date: res.data.date, rates: res.data.rates };
    S.srcs.fx = modeFor(res.stale);
    return true;
  }
  S.srcs.fx = 'demo';
  S.fx = { base: 'USD', date: '—', rates: { EUR: 0.918, GBP: 0.784, JPY: 151.2, CHF: 0.882, AUD: 1.512, CAD: 1.362, NZD: 1.648 } };
  return false;
}

/* ══════════ COT — CFTC positioning (backend-proxied), keyless, weekly ══════════ */
export async function loadCot(S: MarketState, api: ApiClient): Promise<boolean> {
  const res = await api.cot();
  if (res.data && Object.keys(res.data.markets).length) {
    S.cot = {};
    for (const [key, rows] of Object.entries(res.data.markets)) {
      // backend names the yen pair USDJPY (per its own MARKETS map); the
      // rest of this app has always used the bare JPY key (see seedCot()
      // below and the original fiper-terminal.html) — normalise so the
      // COT tab set doesn't change label depending on live vs. modelled.
      const localKey = key === 'USDJPY' ? 'JPY' : key;
      S.cot[localKey] = (rows as any[]).map((r) => ({
        date: r.date, specLong: r.specLong, specShort: r.specShort,
        commLong: r.commLong, commShort: r.commShort, oi: r.openInterest,
      }));
    }
    S.srcs.cot = modeFor(res.stale);
    return true;
  }
  S.srcs.cot = 'demo';
  seedCot(S);
  return false;
}
function seedCot(S: MarketState): void {
  (['EURUSD', 'GBPUSD', 'JPY', 'XAUUSD', 'USOIL', 'BTCUSD'] as const).forEach((k) => {
    let sl = between(90000, 210000);
    let ss = between(70000, 190000);
    S.cot[k] = Array.from({ length: 14 }, (_, i) => {
      sl *= 1 + between(-0.05, 0.05);
      ss *= 1 + between(-0.05, 0.05);
      const dt = new Date(Date.now() - i * 6048e5);
      return {
        date: dt.toISOString().slice(0, 10),
        specLong: Math.round(sl), specShort: Math.round(ss),
        commLong: Math.round(ss * 1.1), commShort: Math.round(sl * 1.05),
        oi: Math.round(sl + ss),
      };
    });
  });
}

/* ══════════ index & commodity quotes — needs TWELVEDATA_KEY server-side ══════════ */
export const TRACKED: { sym: string; name: string; base: number; cls: string }[] = [
  { sym: 'NQUSD', name: 'Nasdaq 100', base: 24102.5, cls: 'index' },
  { sym: 'ESUSD', name: 'S&P 500', base: 6804.53, cls: 'index' },
  { sym: 'YMUSD', name: 'Dow 30', base: 48912.4, cls: 'index' },
  { sym: 'DAX', name: 'DAX 40', base: 23411.8, cls: 'index' },
  { sym: 'XAUUSD', name: 'Gold', base: 4743.26, cls: 'commodity' },
  { sym: 'XAGUSD', name: 'Silver', base: 58.42, cls: 'commodity' },
  { sym: 'USOIL', name: 'WTI Crude', base: 63.18, cls: 'commodity' },
  { sym: 'DXY', name: 'Dollar Index', base: 99.84, cls: 'fx' },
];
const TRACKED_BY_SYM = Object.fromEntries(TRACKED.map((t) => [t.sym, t]));

/** Applies a backend /api/quotes (or WS 'prices'.quotes) payload in place. */
export function applyQuotes(S: MarketState, rows: any[]): void {
  rows.forEach((r) => {
    const meta = TRACKED_BY_SYM[r.symbol];
    const prev = S.quotes[r.symbol];
    S.quotes[r.symbol] = {
      sym: r.symbol,
      name: r.name ?? meta?.name ?? r.symbol,
      base: meta?.base ?? r.price,
      cls: meta?.cls ?? 'index',
      price: r.price,
      chg: r.change,
      hist: prev?.hist ? [...prev.hist.slice(-39), r.price] : Array.from({ length: 40 }, () => r.price),
    };
  });
}

export async function loadQuotes(S: MarketState, api: ApiClient): Promise<boolean> {
  const res = await api.quotes();
  if (res.data && res.data.length) {
    applyQuotes(S, res.data);
    S.srcs.quotes = modeFor(res.stale);
    return true;
  }
  S.srcs.quotes = 'demo';
  seedQuotes(S);
  return false;
}
function seedQuotes(S: MarketState): void {
  TRACKED.forEach((t) => {
    const prev = S.quotes[t.sym];
    const drift = prev ? prev.chg + between(-0.14, 0.14) : between(-1.8, 2.2);
    const chg = Math.max(-5, Math.min(5, drift));
    S.quotes[t.sym] = {
      ...t,
      price: t.base * (1 + chg / 100),
      chg,
      hist: prev?.hist
        ? [...prev.hist.slice(-39), t.base * (1 + chg / 100)]
        : Array.from({ length: 40 }, (_, i) => t.base * (1 + between(-0.012, 0.012) + i * 0.0004)),
    };
  });
}

/* ══════════ news — needs MARKETAUX_KEY or FINNHUB_KEY server-side ══════════ */
export const NEWS_SEED: Omit<NewsItem, 'id' | 'ts' | 'read'>[] = [
  { h: 'FED CHAIR: RATE CUTS REMAIN DATA-DEPENDENT AMID INFLATION RISKS',
    s: 'Powell pushed back on near-term easing bets. Front-end yields higher, dollar bid across majors.',
    full: 'The tone was firmer than the July minutes implied. With core services inflation still running above target, the committee is signalling it wants two more clean prints before moving. Historically a hawkish Powell press conference has lifted DXY by roughly 0.4% on the session and pressured gold.',
    t: ['USD ↑', 'XAUUSD ↓', 'NQUSD ↓'], imp: 'HIGH', cat: 'forex' },
  { h: 'US CPI BEATS EXPECTATIONS AT 0.4% M/M VS 0.2% FORECAST',
    s: 'Hot inflation print narrows the rate-cut window. Broad dollar demand, tech under pressure.',
    full: 'Shelter and medical services drove the upside surprise. The market had positioned for a soft print, so the unwind was sharp. Rate futures now price roughly 30bp less easing across the next four meetings.',
    t: ['DXY ↑', 'EURUSD ↓', 'XAUUSD ↓'], imp: 'HIGH', cat: 'forex' },
  { h: 'ECB LAGARDE: EUROZONE GROWTH WEAKER THAN PROJECTED IN Q2',
    s: 'Downside growth surprises raise odds of an ECB cut before year end. Euro softer, DAX firmer.',
    full: 'Lagarde flagged that manufacturing weakness has spread into services. A weaker euro is not unwelcome for European exporters, which is why the DAX tends to rally on dovish ECB commentary even as EURUSD falls.',
    t: ['EURUSD ↓', 'DAX ↑'], imp: 'HIGH', cat: 'forex' },
  { h: 'OPEC+ CONFIRMS PRODUCTION CUT EXTENSION THROUGH Q3 2026',
    s: 'Supply-side tightening confirmed. Crude supported into resistance, energy names lead.',
    full: 'The extension was broadly expected but compliance language was stricter than anticipated. Watch the $65 area on WTI — a clean break opens the summer highs.',
    t: ['USOIL ↑', 'USD ↑'], imp: 'HIGH', cat: 'commodities' },
  { h: 'BOJ SIGNALS POTENTIAL HIKE IF WAGE DATA CONFIRMS TREND',
    s: 'Hawkish shift from the BOJ. Yen firmer across the board, USDJPY offered.',
    full: 'Spring wage negotiations are the swing factor. If shunto settlements land above 3%, the January meeting becomes live. Carry trades in AUDJPY and MXNJPY are the first to unwind on this.',
    t: ['USDJPY ↓', 'JPY ↑'], imp: 'HIGH', cat: 'forex' },
  { h: 'BITCOIN ETF INFLOWS HIT THREE-MONTH HIGH',
    s: 'Institutional demand returning. Spot ETFs absorbed $840m over five sessions.',
    full: 'Flow concentration remains in two issuers. Sustained inflows above $500m/week have historically preceded a grind higher rather than an impulsive move.',
    t: ['BTCUSD ↑', 'ETHUSD ↑'], imp: 'MED', cat: 'crypto' },
  { h: 'US 10Y YIELD BREAKS ABOVE 4.40% ON SUPPLY CONCERNS',
    s: "Long-end pressure building ahead of next week's auction. Duration-sensitive equities lag.",
    full: 'Term premium is doing the work here rather than rate expectations. That distinction matters: it pressures growth equities without necessarily supporting the dollar.',
    t: ['NQUSD ↓', 'USD ↑'], imp: 'MED', cat: 'indices' },
  { h: 'CHINA MANUFACTURING PMI RETURNS TO EXPANSION AT 50.4',
    s: 'First expansion in seven months. Industrial metals and AUD catch a bid.',
    full: 'New export orders were the strongest component. AUD is the cleanest liquid proxy for Chinese industrial demand, and copper tends to lead the move by a session or two.',
    t: ['AUDUSD ↑', 'XAGUSD ↑'], imp: 'MED', cat: 'commodities' },
  { h: 'NVIDIA GUIDES ABOVE CONSENSUS ON DATA CENTRE DEMAND',
    s: 'Guidance beat lifts the whole semis complex. Nasdaq futures gap higher.',
    full: 'The guide implies continued capex intensity from hyperscalers. Index-level impact is outsized given concentration — the top seven names now drive most of the daily variance in NQ.',
    t: ['NQUSD ↑', 'ESUSD ↑'], imp: 'HIGH', cat: 'indices' },
  { h: 'GOLD HOLDS RECORD GROUND AS CENTRAL BANKS KEEP BUYING',
    s: 'Official-sector demand offsets ETF outflows. Dips continue to get bought.',
    full: 'Central bank purchases have been the structural bid for three years running. This is why gold has decoupled from real yields more than the historical relationship would suggest.',
    t: ['XAUUSD ↑'], imp: 'MED', cat: 'commodities' },
];

/** Backend row -> local NewsItem. `ai` is null when ANTHROPIC_API_KEY isn't
 *  set server-side — the headline itself can still be LIVE (real wire
 *  copy), it just loses its impact/tag classification, which falls back
 *  to neutral defaults rather than blocking the item entirely. */
function adaptNewsRow(r: any): NewsItem {
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
    read: false,
  };
}

export async function loadNews(S: MarketState, api: ApiClient): Promise<boolean> {
  const res = await api.news({ limit: '40' });
  if (res.data && res.data.length) {
    S.news = res.data.map(adaptNewsRow);
    S.srcs.news = modeFor(res.stale);
    return true;
  }
  S.srcs.news = 'demo';
  seedNews(S);
  return false;
}
function seedNews(S: MarketState): void {
  const now = Date.now();
  S.news = NEWS_SEED.map((n, i) => ({ ...n, id: 'n' + i, ts: now - (i * 7 + 2) * 60000, read: false }));
}

/** Merges a WS 'news' push (latest 10 enriched items) in at the front. */
export function applyNewsPush(S: MarketState, rows: any[]): void {
  const incoming = rows.map(adaptNewsRow);
  const known = new Set(incoming.map((n) => n.id));
  S.news = [...incoming, ...S.news.filter((n) => !known.has(n.id))].slice(0, 40);
}

/* ══════════ economic calendar — needs FMP_KEY or TRADING_ECONOMICS_KEY server-side ══════════ */
const EV_SEED: Omit<EventItem, 'day' | 'date' | 'released'>[] = [
  { ccy: 'USD', n: 'Core CPI m/m', t: '13:30', imp: 'HIGH', prev: 0.3, fc: 0.2, act: 0.4, lo: 0.1, hi: 0.4, unit: '%' },
  { ccy: 'USD', n: 'Initial Jobless Claims', t: '13:30', imp: 'MED', prev: 221, fc: 225, act: 218, lo: 215, hi: 238, unit: 'k' },
  { ccy: 'EUR', n: 'ECB Main Refi Rate', t: '13:15', imp: 'HIGH', prev: 3.15, fc: 2.9, act: null, lo: 2.9, hi: 3.15, unit: '%' },
  { ccy: 'GBP', n: 'GDP q/q', t: '07:00', imp: 'HIGH', prev: 0.1, fc: 0.2, act: 0.1, lo: 0.0, hi: 0.4, unit: '%' },
  { ccy: 'USD', n: 'FOMC Meeting Minutes', t: '19:00', imp: 'HIGH', prev: null, fc: null, act: null, lo: null, hi: null, unit: '' },
  { ccy: 'JPY', n: 'BOJ Policy Rate', t: '03:00', imp: 'HIGH', prev: 0.5, fc: 0.5, act: 0.5, lo: 0.25, hi: 0.75, unit: '%' },
  { ccy: 'USD', n: 'ISM Manufacturing PMI', t: '15:00', imp: 'MED', prev: 49.3, fc: 48.5, act: null, lo: 47.8, hi: 50.2, unit: '' },
  { ccy: 'CAD', n: 'Employment Change', t: '13:30', imp: 'MED', prev: 42.1, fc: 18.0, act: null, lo: 5, hi: 35, unit: 'k' },
  { ccy: 'USD', n: 'EIA Crude Oil Inventories', t: '15:30', imp: 'MED', prev: -3.2, fc: -1.5, act: null, lo: -4.0, hi: 0.5, unit: 'M' },
  { ccy: 'AUD', n: 'RBA Rate Statement', t: '03:30', imp: 'HIGH', prev: 4.1, fc: 4.1, act: 4.1, lo: 3.85, hi: 4.1, unit: '%' },
  { ccy: 'EUR', n: 'German Ifo Business Climate', t: '09:00', imp: 'MED', prev: 86.4, fc: 87.1, act: null, lo: 85.5, hi: 88.5, unit: '' },
  { ccy: 'USD', n: 'Non-Farm Payrolls', t: '13:30', imp: 'HIGH', prev: 187, fc: 165, act: null, lo: 130, hi: 210, unit: 'k' },
];

/** Buckets an absolute date into the calendar screen's 0-4 (Mon-Fri) index. */
function dayBucket(d: Date, today: Date): number {
  const mon = new Date(today);
  mon.setDate(today.getDate() - today.getDay() + 1);
  mon.setHours(0, 0, 0, 0);
  const diff = Math.round((+d - +mon) / 864e5);
  return Math.max(0, Math.min(4, diff));
}

export async function loadCalendar(S: MarketState, api: ApiClient): Promise<boolean> {
  const res = await api.calendar();
  if (res.data && res.data.length) {
    const today = new Date();
    S.events = res.data.map((e: any) => {
      const date = new Date(e.time);
      return {
        ccy: e.currency, n: e.event, t: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        imp: e.impact, prev: e.previous, fc: e.forecast, act: e.actual, lo: null, hi: null, unit: e.unit,
        day: dayBucket(date, today), date, released: e.released,
      };
    });
    S.events.sort((a, b) => a.day - b.day || a.t.localeCompare(b.t));
    S.srcs.calendar = modeFor(res.stale);
    return true;
  }
  S.srcs.calendar = 'demo';
  seedCalendar(S);
  return false;
}
function seedCalendar(S: MarketState): void {
  const today = new Date();
  S.events = [];
  for (let d = 0; d < 5; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + 1 + d);
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const e = EV_SEED[(d * 3 + i) % EV_SEED.length];
      S.events.push({
        ...e, day: d, date: new Date(date),
        released: date < today || (date.toDateString() === today.toDateString() && rnd() > 0.5),
      });
    }
  }
  S.events.sort((a, b) => a.day - b.day || a.t.localeCompare(b.t));
}
