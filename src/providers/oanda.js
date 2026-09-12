import { get } from '../lib/http.js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

/**
 * OANDA v20 REST API — practice (demo) environment only.
 *
 * The live host (api-fxtrade.oanda.com) is never referenced anywhere in
 * this file on purpose. Moving to live money is a deliberate future
 * change to this file, not a config flag — see CLAUDE.md "Trade for Me"
 * notes.
 */
const BASE = 'https://api-fxpractice.oanda.com';

function authHeaders() {
  return { Authorization: `Bearer ${config.keys.oanda}` };
}

function ready() {
  return !!(config.keys.oanda && config.oanda.accountId);
}

/** Account balance, NAV, margin used, unrealized P&L. Keyed provider — null if not configured or on failure. */
export async function fetchAccountSummary() {
  if (!ready()) return null;
  const data = await get(`${BASE}/v3/accounts/${config.oanda.accountId}/summary`, { headers: authHeaders() });
  if (!data?.account) return null;
  const a = data.account;
  return {
    balance: +a.balance,
    nav: +a.NAV,
    marginUsed: +a.marginUsed,
    marginAvailable: +a.marginAvailable,
    unrealizedPL: +a.unrealizedPL,
    pl: +a.pl, // OANDA's lifetime realized P&L counter — used to derive today's delta by the caller
    openTradeCount: a.openTradeCount,
    openPositionCount: a.openPositionCount,
    at: Date.now()
  };
}

/** Current bid/ask for a list of OANDA instrument codes, e.g. ['XAU_USD','EUR_USD']. */
export async function fetchPricing(instruments) {
  if (!ready() || !instruments?.length) return null;
  const qs = instruments.map(encodeURIComponent).join(',');
  const data = await get(`${BASE}/v3/accounts/${config.oanda.accountId}/pricing?instruments=${qs}`, { headers: authHeaders() });
  if (!Array.isArray(data?.prices)) return null;
  return data.prices.map(p => ({
    instrument: p.instrument,
    bid: +p.bids?.[0]?.price,
    ask: +p.asks?.[0]?.price,
    at: Date.now()
  }));
}

/** Previous complete daily candle's close — the reference point for a %-change figure, since OANDA's pricing endpoint gives no 24h-change field the way Binance does. */
export async function fetchPrevClose(instrument) {
  if (!ready()) return null;
  const data = await get(`${BASE}/v3/instruments/${encodeURIComponent(instrument)}/candles?granularity=D&count=3&price=M`, { headers: authHeaders() });
  const complete = data?.candles?.filter(c => c.complete);
  if (!complete?.length) return null;
  return +complete[complete.length - 1].mid.c;
}

/** Open positions on the account. */
export async function fetchOpenPositions() {
  if (!ready()) return null;
  const data = await get(`${BASE}/v3/accounts/${config.oanda.accountId}/openPositions`, { headers: authHeaders() });
  if (!Array.isArray(data?.positions)) return null;
  return data.positions.map(p => ({
    instrument: p.instrument,
    longUnits: +p.long?.units || 0,
    shortUnits: +p.short?.units || 0,
    unrealizedPL: +p.unrealizedPL
  }));
}

/**
 * Place a market order. Unlike every read function above, this does NOT
 * fail-soft into `null` on failure — a silently-dropped order must never
 * look identical to "nothing happened" in the trade log, so callers get
 * a discriminated result they're expected to log either way.
 */
export async function placeMarketOrder({ instrument, units, stopLossPrice, takeProfitPrice }) {
  if (!ready()) return { ok: false, error: 'OANDA not configured' };

  const order = {
    order: {
      type: 'MARKET',
      instrument,
      units: String(units), // negative units = short, per OANDA convention
      timeInForce: 'FOK',
      positionFill: 'DEFAULT',
      ...(stopLossPrice ? { stopLossOnFill: { price: String(stopLossPrice) } } : {}),
      ...(takeProfitPrice ? { takeProfitOnFill: { price: String(takeProfitPrice) } } : {})
    }
  };

  try {
    const res = await fetch(`${BASE}/v3/accounts/${config.oanda.accountId}/orders`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(order)
    });
    const body = await res.json();
    if (!res.ok) {
      log.warn(`oanda order rejected: ${body.errorMessage || res.status}`);
      return { ok: false, error: body.errorMessage || `HTTP ${res.status}` };
    }
    if (body.orderCancelTransaction) {
      return { ok: false, error: body.orderCancelTransaction.reason || 'order cancelled' };
    }
    return { ok: true, order: body.orderFillTransaction || body.orderCreateTransaction };
  } catch (err) {
    log.warn(`oanda order failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** Flatten a position (both long and short sides) — used by the manual kill/close action, never automatically. */
export async function closePosition(instrument) {
  if (!ready()) return { ok: false, error: 'OANDA not configured' };
  try {
    const res = await fetch(`${BASE}/v3/accounts/${config.oanda.accountId}/positions/${encodeURIComponent(instrument)}/close`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ longUnits: 'ALL', shortUnits: 'ALL' })
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, error: body.errorMessage || `HTTP ${res.status}` };
    return { ok: true, body };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
