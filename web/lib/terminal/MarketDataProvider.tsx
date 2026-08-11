'use client';

/* ══════════════════════════════════════════════════════════════
   Backend-wired version. Still one React Context standing in for the
   original's global mutable `S` + boot() + refresh loop — but now:

     1. boot() fetches every category once over REST from the backend
        (apiClient.ts) instead of the browser hitting providers directly
        — same relative order as the original (quotes -> news ->
        calendar -> [crypto, fx, cot] parallel) so the PRNG sequence any
        still-modelled category draws from stays reproducible (see
        rng.ts).
     2. Ongoing updates come from the backend's WebSocket push
        ('prices' and 'news' channels) instead of a 20s poll — replacing
        the *mechanism*, not the categories: fx/cot still only refresh
        slowly over REST because the backend itself never broadcasts
        them (src/lib/scheduler.js's refreshDaily() has no broadcast()
        call — they only change daily/weekly).
     3. When the socket can't stay connected, apiClient's connection
        state drops to 'rest-fallback' and this provider starts an
        actual REST polling interval as the substitute for the missing
        push — the same loadQuotes/loadCrypto cadence the original
        always ran, just now scoped to only when it's actually needed.
     4. connectionState is exposed alongside data so TopBar can render a
        connected/reconnecting/rest-fallback indicator.

   NOTE on the effect below: `bootedRef` exists so boot() runs exactly
   once, ever — surviving React Strict Mode's dev-only mount -> cleanup
   -> remount double-invoke (the second invocation sees bootedRef
   already true and exits immediately, deliberately without registering
   its own cleanup). That means the *first* invocation's boot() is the
   one that must keep running and keep publishing after Strict Mode's
   synthetic cleanup fires — so, unlike a typical effect, this one does
   NOT gate its async continuations on a "was I cleaned up" flag. That
   would silently stop every future update dead (verified: an earlier
   draft gated `publish()` on exactly such a flag and every badge stuck
   on '…' forever, because Strict Mode's synthetic cleanup flips it
   before the very first network response lands). The tradeoff is the
   usual one for this pattern: intervals started after Strict Mode's one
   synthetic cleanup won't be cleared by it — acceptable here since this
   provider wraps the whole /app route for the life of the tab.
══════════════════════════════════════════════════════════════ */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CONFIG } from './config';
import { createClient, type ApiClient, type ConnectionState } from './apiClient';
import {
  applyCrypto,
  applyNewsPush,
  applyQuotes,
  createMarketState,
  loadCalendar,
  loadCot,
  loadCrypto,
  loadFx,
  loadNews,
  loadQuotes,
  NEWS_SEED,
  type MarketState,
} from './marketData';
import { computeRisk } from './bias';

interface MarketDataContextValue {
  data: MarketState;
  tick: number;
  connectionState: ConnectionState;
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

export function useMarketData(): MarketState {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error('useMarketData must be used within <MarketDataProvider>');
  return ctx.data;
}

export function useConnectionState(): ConnectionState {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error('useConnectionState must be used within <MarketDataProvider>');
  return ctx.connectionState;
}

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const Sref = useRef<MarketState>();
  if (!Sref.current) Sref.current = createMarketState();
  const apiRef = useRef<ApiClient>();
  if (!apiRef.current) apiRef.current = createClient();
  const bootedRef = useRef(false);
  const restFallbackInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoNewsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('reconnecting');

  useEffect(() => {
    if (bootedRef.current) return; // Strict Mode double-invoke guard — boot() must run exactly once
    bootedRef.current = true;
    const S = Sref.current!;
    const api = apiRef.current!;

    const publish = () => {
      computeRisk(S); // same as the original's renderAll() calling computeRisk() before every render
      setTick((t) => t + 1);
    };

    const startRestPolling = () => {
      if (restFallbackInterval.current) return;
      restFallbackInterval.current = setInterval(async () => {
        await Promise.allSettled([loadQuotes(S, api), loadCrypto(S, api)]);
        publish();
      }, CONFIG.refreshMs);
    };
    const stopRestPolling = () => {
      if (restFallbackInterval.current) {
        clearInterval(restFallbackInterval.current);
        restFallbackInterval.current = null;
      }
    };

    async function boot() {
      // ── same order as the original boot(): quotes -> news -> calendar ──
      await loadQuotes(S, api);
      await loadNews(S, api);
      await loadCalendar(S, api);
      publish();

      // ── live sources — each fails soft to a modelled fallback, run in parallel ──
      await Promise.allSettled([loadCrypto(S, api), loadFx(S, api), loadCot(S, api)]);
      publish();

      // ── ongoing updates: WS push in place of the old 20s poll ──
      api.onUpdate('prices', (payload: { crypto?: any[]; quotes?: any[] }) => {
        if (payload.crypto?.length) { applyCrypto(S, payload.crypto); S.srcs.crypto = 'live'; }
        if (payload.quotes?.length) { applyQuotes(S, payload.quotes); S.srcs.quotes = 'live'; }
        publish();
      });
      api.onUpdate('news', (rows: any[]) => {
        if (!rows?.length) return;
        applyNewsPush(S, rows);
        S.srcs.news = 'live';
        publish();
      });
      api.onConnectionState((s) => {
        setConnectionState(s);
        if (s === 'rest-fallback') startRestPolling();
        else stopRestPolling();
      });

      // fx/cot: REST-only, matches the backend never broadcasting them
      slowInterval.current = setInterval(async () => {
        await Promise.allSettled([loadFx(S, api), loadCot(S, api)]);
        publish();
      }, CONFIG.slowRefreshMs);

      // cosmetic-only: rotate a fresh demo headline in while news has no
      // real key configured server-side, exactly like the original's
      // "rotate a fresh headline in occasionally" — uses Math.random(),
      // not the seeded rnd(), same as the original (ticker noise, not
      // reproducible modelled data). No-ops once news is actually live.
      demoNewsInterval.current = setInterval(() => {
        if (S.srcs.news !== 'demo') return;
        if (Math.random() > 0.55) {
          const seed = NEWS_SEED[Math.floor(Math.random() * NEWS_SEED.length)];
          S.news.unshift({ ...seed, id: 'n' + Date.now(), ts: Date.now(), read: false });
          S.news = S.news.slice(0, 24);
          publish();
        }
      }, CONFIG.refreshMs);
    }
    boot();

    return () => {
      stopRestPolling();
      if (slowInterval.current) clearInterval(slowInterval.current);
      if (demoNewsInterval.current) clearInterval(demoNewsInterval.current);
    };
  }, []);

  const value = useMemo<MarketDataContextValue>(
    () => ({ data: Sref.current!, tick, connectionState }),
    [tick, connectionState]
  );

  return <MarketDataContext.Provider value={value}>{children}</MarketDataContext.Provider>;
}
