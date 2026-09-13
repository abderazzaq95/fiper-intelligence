import { config } from '../config.js';
import { log } from '../lib/logger.js';

/**
 * Capital.com REST API — demo (paper) environment only.
 *
 * The live host (api-capital.backend-capital.com) is never referenced
 * anywhere in this file on purpose — same rule as the OANDA integration
 * this replaces. Moving to live money is a deliberate future change to
 * this file, not a config flag.
 *
 * Unlike OANDA's single static bearer token, Capital.com uses a 10-minute
 * session: POST /session returns CST + X-SECURITY-TOKEN headers that
 * must be attached to every subsequent request, and re-authenticates
 * lazily here on first use or after a 401.
 *
 * Some response shapes below (market snapshot fields, positions list
 * shape, transaction history fields) are best-effort from Capital.com's
 * public docs/Postman collection rather than a live-verified response —
 * flagged inline. They're written to fail soft (return null) rather than
 * throw if a field isn't where expected, so a wrong guess degrades one
 * widget instead of crashing the backend.
 */
const BASE = 'https://demo-api-capital.backend-capital.com/api/v1';
const SESSION_MAX_AGE = 9 * 60_000; // re-auth before Capital.com's own 10-minute idle timeout

let session = null; // { cst, securityToken, at }
let authInFlight = null; // single-flight guard — see authenticate()

function ready() {
  return !!(config.keys.capital && config.capital.identifier && config.capital.password);
}

async function doAuthenticate() {
  const res = await fetch(`${BASE}/session`, {
    method: 'POST',
    headers: { 'X-CAP-API-KEY': config.keys.capital, 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: config.capital.identifier, password: config.capital.password })
  });
  if (!res.ok) {
    log.warn(`capital.com auth failed: HTTP ${res.status}`);
    session = null;
    return null;
  }
  const cst = res.headers.get('cst');
  const securityToken = res.headers.get('x-security-token');
  if (!cst || !securityToken) { session = null; return null; }
  session = { cst, securityToken, at: Date.now() };
  return session;
}

/**
 * Single-flighted: refreshBroker() fires several requests in parallel
 * (account, positions, one per instrument's price) and with no session
 * yet, every one of them would otherwise call this at the same instant.
 * Capital.com allows only 1 request/second to /session, so that stampede
 * gets rate-limited (HTTP 429) rather than authenticated — concurrent
 * callers now share the one in-flight login instead.
 */
function authenticate() {
  if (!authInFlight) {
    authInFlight = doAuthenticate().finally(() => { authInFlight = null; });
  }
  return authInFlight;
}

async function ensureSession() {
  if (session && Date.now() - session.at < SESSION_MAX_AGE) return session;
  return authenticate();
}

/** Authenticated GET, retried once after a fresh login if the session was rejected. */
async function authedGet(path) {
  if (!ready()) return null;
  let s = await ensureSession();
  if (!s) return null;

  let res = await fetch(`${BASE}${path}`, { headers: { 'X-CAP-API-KEY': config.keys.capital, CST: s.cst, 'X-SECURITY-TOKEN': s.securityToken } });
  if (res.status === 401) {
    s = await authenticate();
    if (!s) return null;
    res = await fetch(`${BASE}${path}`, { headers: { 'X-CAP-API-KEY': config.keys.capital, CST: s.cst, 'X-SECURITY-TOKEN': s.securityToken } });
  }
  if (!res.ok) { log.warn(`capital.com GET ${path} failed: HTTP ${res.status}`); return null; }
  try { return await res.json(); } catch { return null; }
}

/** Account balance/available funds. Field names are best-effort (accounts[].balance.*) pending live verification. */
export async function fetchAccountSummary() {
  const data = await authedGet('/accounts');
  const acct = data?.accounts?.[0];
  if (!acct?.balance) return null;
  return {
    balance: +acct.balance.balance,
    available: +acct.balance.available,
    deposit: acct.balance.deposit != null ? +acct.balance.deposit : null,
    unrealizedPL: acct.balance.profitLoss != null ? +acct.balance.profitLoss : 0,
    currency: acct.currency ?? 'EUR',
    at: Date.now()
  };
}

/** Current bid/offer for one epic (Capital.com has no confirmed batch-pricing endpoint, so callers loop this per instrument). */
export async function fetchMarket(epic) {
  const data = await authedGet(`/markets/${encodeURIComponent(epic)}`);
  const snap = data?.snapshot;
  if (!snap || snap.bid == null || snap.offer == null) return null;
  return { epic, bid: +snap.bid, offer: +snap.offer, at: Date.now() };
}

/** Search broker markets so callers can resolve an instrument's current epic. */
export async function searchMarkets(searchTerm) {
  const data = await authedGet(`/markets?searchTerm=${encodeURIComponent(searchTerm)}`);
  return Array.isArray(data?.markets) ? data.markets : [];
}

/** Previous complete daily candle's close, for the same %-change-vs-yesterday purpose oanda.js's fetchPrevClose served. */
export async function fetchPrevClose(epic) {
  const data = await authedGet(`/prices/${encodeURIComponent(epic)}?resolution=DAY&max=2`);
  const prices = data?.prices;
  if (!Array.isArray(prices) || prices.length < 1) return null;
  const row = prices[0]; // oldest of the returned window
  const close = row?.closePrice;
  if (!close || close.bid == null || close.ask == null) return null;
  return (+close.bid + +close.ask) / 2;
}

/** Open positions on the account. dealId is Capital.com's per-position identifier, used the same way OANDA's tradeID was — to look up an outcome once it closes. */
export async function fetchOpenPositions() {
  const data = await authedGet('/positions');
  const rows = data?.positions;
  if (!Array.isArray(rows)) return null;
  return rows.map(r => ({
    dealId: r.position?.dealId,
    epic: r.market?.epic,
    direction: r.position?.direction, // 'BUY' | 'SELL'
    size: +r.position?.size,
    unrealizedPL: +(r.position?.upl ?? 0)
  }));
}

/**
 * Place a market position. Unlike the read functions above, this does
 * NOT fail-soft into `null` on failure — a silently-dropped order must
 * never look identical to "nothing happened" in the trade log.
 */
export async function placeMarketOrder({ epic, direction, size, stopLevel, profitLevel }) {
  if (!ready()) return { ok: false, error: 'Capital.com not configured' };
  const s = await ensureSession();
  if (!s) return { ok: false, error: 'Capital.com authentication failed' };

  const headers = { 'X-CAP-API-KEY': config.keys.capital, CST: s.cst, 'X-SECURITY-TOKEN': s.securityToken, 'content-type': 'application/json' };
  const body = {
    epic, direction, size,
    guaranteedStop: false,
    ...(stopLevel ? { stopLevel } : {}),
    ...(profitLevel ? { profitLevel } : {})
  };

  try {
    const res = await fetch(`${BASE}/positions`, { method: 'POST', headers, body: JSON.stringify(body) });
    const created = await res.json();
    if (!res.ok || !created.dealReference) {
      return { ok: false, error: created.errorCode || `HTTP ${res.status}` };
    }

    // Order placement is async on Capital.com — confirm the fill separately.
    const confirm = await authedGet(`/confirms/${encodeURIComponent(created.dealReference)}`);
    if (!confirm) return { ok: false, error: 'no confirmation received' };
    if (confirm.dealStatus && confirm.dealStatus !== 'ACCEPTED') {
      return { ok: false, error: confirm.reason || confirm.dealStatus };
    }
    return { ok: true, order: confirm };
  } catch (err) {
    log.warn(`capital.com order failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** Closes a position outright — the manual kill/close action, never automatic. */
export async function closePosition(dealId) {
  if (!ready()) return { ok: false, error: 'Capital.com not configured' };
  const s = await ensureSession();
  if (!s) return { ok: false, error: 'Capital.com authentication failed' };
  try {
    const res = await fetch(`${BASE}/positions/${encodeURIComponent(dealId)}`, {
      method: 'DELETE',
      headers: { 'X-CAP-API-KEY': config.keys.capital, CST: s.cst, 'X-SECURITY-TOKEN': s.securityToken, 'content-type': 'application/json' }
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, error: body.errorCode || `HTTP ${res.status}` };
    return { ok: true, body };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Realized P&L for a dealId that is no longer in the open-positions list
 * — searched from recent transaction history since Capital.com has no
 * confirmed single-trade lookup the way OANDA's /trades/{id} did. Returns
 * null (not-yet-found) rather than throwing if the shape doesn't match;
 * the caller (autotrader.refreshClosedTrades) caps retries so an
 * unresolvable lookup doesn't poll forever.
 */
export async function fetchClosedPnl(dealId) {
  const to = new Date().toISOString().slice(0, 19);
  const from = new Date(Date.now() - 48 * 3600_000).toISOString().slice(0, 19);
  const data = await authedGet(`/history/transactions?from=${from}&to=${to}`);
  const rows = data?.transactions;
  if (!Array.isArray(rows)) return null;
  const match = rows.find(r => r.dealId === dealId && r.profitAndLoss != null);
  return match ? +match.profitAndLoss : null;
}
