import { Router } from 'express';
import { cache } from '../lib/cache.js';
import { config, providerHealth } from '../config.js';
import { fetchKlines } from '../providers/binance.js';
import { fetchExternalKlines } from '../providers/yahoo.js';
import { closePosition } from '../providers/oanda.js';
import * as autotrader from '../services/autotrader.js';
import { clientCount } from '../ws/hub.js';

export const router = Router();

/** Every response says where the data came from and how old it is. */
function serve(res, key, extra = {}) {
  const data = cache.get(key) ?? cache.getStale(key);
  const meta = cache.meta(key);

  if (!data) {
    return res.status(503).json({
      ok: false,
      error: `No data for "${key}" yet.`,
      hint: providerHealth()[key]?.enabled === false
        ? `Provider disabled — set ${providerHealth()[key].needs} in .env`
        : 'Upstream has not responded since boot. Check /api/status.'
    });
  }
  res.json({ ok: true, data, stale: meta?.stale ?? false, ageMs: meta?.ageMs ?? 0, ...extra });
}

router.get('/status', (_req, res) => {
  const providers = providerHealth();
  const cached = Object.fromEntries(cache.keys().map(k => [k, cache.meta(k)]));
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    wsClients: clientCount(),
    providers,
    cache: cached,
    disabled: Object.entries(providers).filter(([, p]) => !p.enabled).map(([k, p]) => ({ provider: k, needs: p.needs }))
  });
});

router.get('/markets',  (_q, r) => {
  const crypto = cache.getStale('crypto') ?? [];
  const quotes = cache.getStale('quotes') ?? [];
  r.json({ ok: true, data: [...quotes, ...crypto], counts: { quotes: quotes.length, crypto: crypto.length } });
});

router.get('/crypto',   (_q, r) => serve(r, 'crypto'));
router.get('/quotes',   (_q, r) => serve(r, 'quotes'));
router.get('/fx',       (_q, r) => serve(r, 'fx'));
router.get('/cot',      (_q, r) => serve(r, 'cot'));
router.get('/risk',     (_q, r) => serve(r, 'risk'));
router.get('/bias',     (_q, r) => serve(r, 'bias'));
router.get('/calendar', (_q, r) => serve(r, 'calendar'));

router.get('/news', (req, res) => {
  const all = cache.getStale('news');
  if (!all) {
    return res.status(503).json({
      ok: false,
      error: 'News provider not configured.',
      hint: 'Set MARKETAUX_KEY or FINNHUB_KEY in .env'
    });
  }
  const { category, impact, limit = 40 } = req.query;
  let rows = all;
  if (category) rows = rows.filter(n => n.ai?.category === category);
  if (impact)   rows = rows.filter(n => n.ai?.impact === String(impact).toUpperCase());
  res.json({ ok: true, data: rows.slice(0, Number(limit)), total: all.length });
});

router.get('/bias/:symbol', (req, res) => {
  const bias = cache.getStale('bias') ?? {};
  const hit = bias[req.params.symbol.toUpperCase()];
  if (!hit) return res.status(404).json({ ok: false, error: `No bias for ${req.params.symbol}` });
  res.json({ ok: true, data: hit });
});

/** Candles proxied so the browser never talks to Binance directly. */
router.get('/klines/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1h', limit = 100 } = req.query;
  if (!/^(1m|5m|15m|30m|1h|4h|1d|1w)$/.test(interval)) {
    return res.status(400).json({ ok: false, error: 'Unsupported interval' });
  }
  const key = `klines:${symbol}:${interval}:${limit}`;
  const hit = cache.get(key);
  if (hit) return res.json({ ok: true, data: hit, cached: true });

  const data = await fetchKlines(symbol, interval, Math.min(Number(limit), 500));
  if (!data) return res.status(502).json({ ok: false, error: 'Upstream unavailable' });
  cache.set(key, data, 30_000);
  res.json({ ok: true, data, cached: false });
});

/** Non-crypto OHLC (indices/commodities/FX) via Yahoo Finance, proxied
 *  for the same reason as /klines above — plus Yahoo's chart API has no
 *  CORS allowance for browser callers, so this one isn't optional the
 *  way the Binance proxy is. `:symbol` is already Yahoo's own ticker
 *  (e.g. GC=F, EURUSD=X) — the frontend resolves that mapping before
 *  calling this route. */
router.get('/klines-external/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1h', limit = 80 } = req.query;
  if (!/^(1m|5m|15m|1h|4h|1d)$/.test(interval)) {
    return res.status(400).json({ ok: false, error: 'Unsupported interval' });
  }
  const key = `klines-external:${symbol}:${interval}:${limit}`;
  const hit = cache.get(key);
  if (hit) return res.json({ ok: true, data: hit, cached: true });

  const data = await fetchExternalKlines(symbol, interval, Math.min(Number(limit), 500));
  if (!data) return res.status(502).json({ ok: false, error: 'Upstream unavailable' });
  cache.set(key, data, 30_000);
  res.json({ ok: true, data, cached: false });
});

/* ═══════════════════════════════════════════════════════════════════
   "Trade for Me" — paper-trading auto-execution via OANDA. Read routes
   are open like everything else above; the POST routes below actually
   control order placement, so they're gated by TRADE_API_SECRET when
   one is configured — the rest of this API has no auth concept, and
   this is the one surface where that stops being acceptable.
═══════════════════════════════════════════════════════════════════ */
function requireTradeSecret(req, res, next) {
  if (!config.trade.apiSecret) return next(); // no secret configured — fine for a personal localhost-only setup, but the /trade/status response flags it
  if (req.get('x-trade-secret') === config.trade.apiSecret) return next();
  res.status(401).json({ ok: false, error: 'Missing or invalid x-trade-secret header' });
}

router.get('/trade/status', (_req, res) => {
  const settings = autotrader.getSettings();
  res.json({
    ok: true,
    data: {
      settings,
      supportedInstruments: autotrader.supportedInstruments(),
      account: cache.getStale('oanda:account'),
      dailyPl: autotrader.getDailyPl(),
      secretConfigured: !!config.trade.apiSecret,
      oandaConfigured: !!(config.keys.oanda && config.oanda.accountId)
    }
  });
});

router.get('/trade/positions', (_req, res) => {
  res.json({ ok: true, data: cache.getStale('oanda:positions') ?? [] });
});

router.get('/trade/history', (req, res) => {
  const { limit = 50 } = req.query;
  res.json({ ok: true, data: autotrader.getHistory().slice(0, Number(limit)) });
});

router.post('/trade/settings', requireTradeSecret, (req, res) => {
  const next = autotrader.updateSettings(req.body ?? {});
  res.json({ ok: true, data: next });
});

router.post('/trade/kill', requireTradeSecret, (req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 200) : 'manual';
  const next = autotrader.tripKillSwitch(reason);
  res.json({ ok: true, data: next });
});

/** Closes a position outright — a separate explicit action from the kill switch, which only stops new orders. */
router.post('/trade/close/:instrument', requireTradeSecret, async (req, res) => {
  const result = await closePosition(req.params.instrument);
  if (!result.ok) return res.status(502).json({ ok: false, error: result.error });
  res.json({ ok: true, data: result.body });
});
