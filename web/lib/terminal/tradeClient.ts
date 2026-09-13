/* Thin client for /api/trade/* — kept separate from apiClient.ts's
   MarketState singleton on purpose: trade state is mutable, sensitive,
   and only needed by TradeScreen, unlike the other 11 read-only screens
   that all share the same polled MarketState. Same {ok,data,...}
   envelope convention as apiClient.ts's call(). */

import { CONFIG } from './config';

/* Only meaningful if the backend is reachable beyond your own machine —
   authenticated mutations use a same-origin Next.js route, so
   TRADE_API_SECRET remains server-side and is never bundled. */

export interface TradeSettings {
  enabled: boolean;
  riskPct: number;
  minConfidence: number;
  allowedInstruments: string[];
  killSwitch: { at: number; reason: string } | null;
}

export interface BrokerAccount {
  balance: number;
  available: number;
  deposit: number | null;
  unrealizedPL: number;
  currency: string;
  at: number;
}

export interface BrokerPosition {
  dealId: string;
  epic: string;
  direction: 'BUY' | 'SELL';
  size: number;
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
  account: BrokerAccount | null;
  dailyPl: number | null;
  stats: TradeStats;
  secretConfigured: boolean;
  brokerConfigured: boolean;
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
  outcome?: 'win' | 'loss' | 'breakeven' | 'unknown';
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
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
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
  positions: () => getJson<BrokerPosition[]>('/trade/positions'),
  history: (limit = 50) => getJson<TradeHistoryEntry[]>(`/trade/history?limit=${limit}`),
  updateSettings: (patch: Partial<TradeSettings>) => postJson<TradeSettings>('/trade/settings', patch),
  killSwitch: (reason: string) => postJson<TradeSettings>('/trade/kill', { reason }),
  testOrder: (direction: 'BUY' | 'SELL' = 'BUY') => postJson<unknown>('/trade/test-order', { confirm: true, direction }),
  closePosition: (dealId: string) => postJson<unknown>(`/trade/close/${encodeURIComponent(dealId)}`, {}),
};
