/* Thin client for /api/trade/* — kept separate from apiClient.ts's
   MarketState singleton on purpose: trade state is mutable, sensitive,
   and only needed by TradeScreen, unlike the other 11 read-only screens
   that all share the same polled MarketState. Same {ok,data,...}
   envelope convention as apiClient.ts's call(). */

import { CONFIG } from './config';

/* Only meaningful if the backend is reachable beyond your own machine —
   for a purely local personal setup TRADE_API_SECRET/this can stay
   unset. Necessarily public (NEXT_PUBLIC_*) since the browser is the
   one calling the backend directly, same tradeoff config.js's own
   comment on TRADE_API_SECRET already documents ("cheap guard", not a
   real security boundary). */
const TRADE_SECRET = process.env.NEXT_PUBLIC_TRADE_API_SECRET;

export interface TradeSettings {
  enabled: boolean;
  riskPct: number;
  minConfidence: number;
  allowedInstruments: string[];
  killSwitch: { at: number; reason: string } | null;
}

export interface OandaAccount {
  balance: number;
  nav: number;
  marginUsed: number;
  marginAvailable: number;
  unrealizedPL: number;
  pl: number;
  at: number;
}

export interface OandaPosition {
  instrument: string;
  longUnits: number;
  shortUnits: number;
  unrealizedPL: number;
}

export interface TradeStats {
  closedCount: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  netRealizedPl: number;
}

export interface TradeStatus {
  settings: TradeSettings;
  supportedInstruments: string[];
  account: OandaAccount | null;
  dailyPl: number | null;
  stats: TradeStats;
  secretConfigured: boolean;
  oandaConfigured: boolean;
}

export interface TradeHistoryEntry {
  at: number;
  symbol: string;
  instrument?: string;
  action: 'order' | 'skip' | 'error';
  reason?: string;
  direction?: 'Bullish' | 'Bearish' | 'Neutral';
  units?: number;
  price?: number;
  stopPrice?: number;
  targetPrice?: number;
  confidence?: number;
  inputs?: Record<string, number>;
  error?: string;
  tradeId?: string;
  outcome?: 'win' | 'loss' | 'breakeven';
  realizedPL?: number;
  closedAt?: number;
}

interface Result<T> {
  data: T | null;
  error?: string;
}

async function getJson<T>(path: string): Promise<Result<T>> {
  try {
    const res = await fetch(`${CONFIG.apiBase}/api${path}`);
    const body = await res.json();
    if (!body.ok) return { data: null, error: body.error };
    return { data: body.data };
  } catch (err: any) {
    return { data: null, error: err?.message ?? 'network error' };
  }
}

async function postJson<T>(path: string, body: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`${CONFIG.apiBase}/api${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(TRADE_SECRET ? { 'x-trade-secret': TRADE_SECRET } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const parsed = await res.json();
    if (!parsed.ok) return { data: null, error: parsed.error };
    return { data: parsed.data };
  } catch (err: any) {
    return { data: null, error: err?.message ?? 'network error' };
  }
}

export const tradeClient = {
  status: () => getJson<TradeStatus>('/trade/status'),
  positions: () => getJson<OandaPosition[]>('/trade/positions'),
  history: (limit = 50) => getJson<TradeHistoryEntry[]>(`/trade/history?limit=${limit}`),
  updateSettings: (patch: Partial<TradeSettings>) => postJson<TradeSettings>('/trade/settings', patch),
  killSwitch: (reason: string) => postJson<TradeSettings>('/trade/kill', { reason }),
  closePosition: (instrument: string) => postJson<unknown>(`/trade/close/${encodeURIComponent(instrument)}`, {}),
};
