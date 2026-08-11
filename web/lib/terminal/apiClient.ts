/* ══════════════════════════════════════════════════════════════
   Ported from src/lib/frontend-client.js (the backend's own adapter —
   its header says "copy into the frontend, or serve it from the API and
   import it"). Copied rather than imported so web/ stays buildable
   standalone with no cross-package reach into src/.

   Two additions over the original:
     1. Base URL comes from CONFIG.apiBase (NEXT_PUBLIC_API_URL) instead
        of a hardcoded default.
     2. onConnectionState(fn) exposes the WS lifecycle so the UI can show
        a connected/reconnecting/rest-fallback indicator — the original
        adapter has no concept of connection state to report, only raw
        channel data.

   Reconnect policy (unchanged from the original): exponential backoff
   from 1s, capped at 30s, retried forever. State reporting layered on
   top: 'connected' while the socket is OPEN, 'reconnecting' for the
   first few backoff steps, 'rest-fallback' once backoff has hit its
   30s cap at least once (i.e. WS has failed repeatedly) — see
   MarketDataProvider.tsx for what 'rest-fallback' actually triggers
   (a REST polling interval standing in for the missing push).
══════════════════════════════════════════════════════════════ */

import { CONFIG } from './config';

export type ConnectionState = 'connected' | 'reconnecting' | 'rest-fallback';

export interface ApiResult<T> {
  data: T | null;
  stale?: boolean;
  ageMs?: number;
  error?: string;
  hint?: string;
}

const MAX_BACKOFF = 30_000;

export function createClient(base: string = CONFIG.apiBase) {
  const listeners = new Map<string, Set<(data: any) => void>>();
  const stateListeners = new Set<(s: ConnectionState) => void>();
  let socket: WebSocket | null = null;
  let delay = 1000;
  let hitMaxBackoff = false;
  let connState: ConnectionState = 'reconnecting';

  function setState(s: ConnectionState) {
    if (s === connState) return;
    connState = s;
    stateListeners.forEach((fn) => fn(s));
  }

  async function call<T = any>(path: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${base}/api${path}`);
      const body = await res.json();
      if (!body.ok) return { data: null, error: body.error, hint: body.hint };
      return { data: body.data, stale: body.stale, ageMs: body.ageMs };
    } catch (err: any) {
      return { data: null, error: err?.message ?? 'network error' };
    }
  }

  function connect() {
    if (typeof WebSocket === 'undefined') return; // SSR guard
    const url = base.replace(/^http/, 'ws') + '/ws';
    socket = new WebSocket(url);

    socket.onmessage = (e) => {
      try {
        const { type, data } = JSON.parse(e.data);
        listeners.get(type)?.forEach((fn) => fn(data));
      } catch {
        /* ignore malformed frames */
      }
    };
    // reconnect with backoff rather than hammering a downed server
    socket.onclose = () => {
      setState(hitMaxBackoff ? 'rest-fallback' : 'reconnecting');
      setTimeout(() => {
        delay = Math.min(delay * 2, MAX_BACKOFF);
        if (delay >= MAX_BACKOFF) hitMaxBackoff = true;
        connect();
      }, delay);
    };
    socket.onopen = () => {
      delay = 1000;
      hitMaxBackoff = false;
      setState('connected');
    };
    socket.onerror = () => {
      /* onclose fires right after; state handled there */
    };
  }

  return {
    status: () => call('/status'),
    markets: () => call('/markets'),
    crypto: () => call<any[]>('/crypto'),
    quotes: () => call<any[]>('/quotes'),
    fx: () => call<{ base: string; date: string; rates: Record<string, number>; source: string }>('/fx'),
    cot: () => call<{ markets: Record<string, any[]>; source: string }>('/cot'),
    risk: () => call('/risk'),
    bias: (symbol?: string) => call(symbol ? `/bias/${symbol}` : '/bias'),
    news: (opts: Record<string, string> = {}) => call<any[]>('/news?' + new URLSearchParams(opts)),
    calendar: () => call<any[]>('/calendar'),
    klines: (symbol: string, interval = '1h', limit = 100) =>
      call<any[]>(`/klines/${symbol}?interval=${interval}&limit=${limit}`),
    klinesExternal: (symbol: string, interval = '1h', limit = 100) =>
      call<any[]>(`/klines-external/${encodeURIComponent(symbol)}?interval=${interval}&limit=${limit}`),

    onUpdate(channel: string, fn: (data: any) => void) {
      if (!socket) connect();
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel)!.add(fn);
      return () => listeners.get(channel)?.delete(fn);
    },

    onConnectionState(fn: (s: ConnectionState) => void) {
      if (!socket) connect();
      stateListeners.add(fn);
      fn(connState);
      return () => stateListeners.delete(fn);
    },
  };
}

export type ApiClient = ReturnType<typeof createClient>;
