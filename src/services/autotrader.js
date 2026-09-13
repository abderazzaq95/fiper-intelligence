import { cache } from '../lib/cache.js';
import { log } from '../lib/logger.js';
import { config } from '../config.js';
import { computeBias } from './bias.js';
import * as capital from '../providers/capital.js';
import { broadcast } from '../ws/hub.js';

/**
 * "Trade for Me" — paper-trading auto-execution.
 *
 * Validation philosophy mirrors interpret.js's validate(): a hardcoded
 * allowlist, every number clamped, nothing here is ever trusted blindly
 * just because it came out of a formula. The only difference from
 * interpret.js is what's being validated — a position size and a stop
 * distance instead of model output — but the same rule applies: an
 * unexplainable, unbounded trading decision is worse than no decision.
 *
 * Demo account only. No live Capital.com host exists anywhere in this
 * file or in providers/capital.js — see CLAUDE.md.
 */

// canonical app symbol (matches bias.js/cftc.js/interpret.js convention) -> Capital.com epic
const CAPITAL_EPIC = {
  XAUUSD: 'GOLD',
  XAGUSD: 'SILVER',
  EURUSD: 'EURUSD',
  GBPUSD: 'GBPUSD',
  USDJPY: 'USDJPY',
  AUDUSD: 'AUDUSD',
  USDCAD: 'USDCAD',
  USDCHF: 'USDCHF',
  NZDUSD: 'NZDUSD'
};

const SETTINGS_KEY = 'trade:settings';
const HISTORY_KEY = 'trade:history';
const HISTORY_LIMIT = 200;
const LONG_TTL = 365 * 24 * 3600_000; // settings/history — not a real cache, just this backend's only persistence mechanism (see CLAUDE.md Redis/Postgres roadmap)
const MAX_OUTCOME_ATTEMPTS = 15; // ~5 min of retrying at the broker poll cadence before giving up on resolving a closed trade's P&L

function defaultSettings() {
  return {
    enabled: config.trade.enabledDefault,
    riskPct: config.trade.maxRiskPct,
    minConfidence: config.trade.minConfidence,
    allowedInstruments: config.trade.allowedInstruments.filter(s => CAPITAL_EPIC[s]),
    killSwitch: null // { at, reason } once the daily-loss breaker (or a manual kill) has fired
  };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

export function getSettings() {
  return cache.get(SETTINGS_KEY) ?? cache.set(SETTINGS_KEY, defaultSettings(), LONG_TTL);
}

export function updateSettings(patch) {
  const current = getSettings();
  const next = { ...current };

  if ('enabled' in patch) {
    next.enabled = !!patch.enabled;
    // re-enabling clears a previously tripped kill switch — an explicit user action, never automatic
    if (next.enabled) next.killSwitch = null;
  }
  if ('riskPct' in patch) next.riskPct = clamp(Number(patch.riskPct), 0.1, config.trade.maxRiskPct);
  if ('minConfidence' in patch) next.minConfidence = clamp(Number(patch.minConfidence), 40, 95);
  if ('allowedInstruments' in patch && Array.isArray(patch.allowedInstruments)) {
    next.allowedInstruments = patch.allowedInstruments.filter(s => CAPITAL_EPIC[s]);
  }

  cache.set(SETTINGS_KEY, next, LONG_TTL);
  return next;
}

export function tripKillSwitch(reason = 'manual') {
  const next = { ...getSettings(), enabled: false, killSwitch: { at: Date.now(), reason } };
  cache.set(SETTINGS_KEY, next, LONG_TTL);
  log.warn(`trade kill switch: ${reason}`);
  broadcast('trades', { settings: next });
  return next;
}

export function getHistory() {
  return cache.getStale(HISTORY_KEY) ?? [];
}

function isToday(ts) {
  return new Date(ts).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
}

/** Sum of realized P&L across trades this build closed today. Used both for display and the daily circuit breaker. */
export function getDailyPl() {
  const closedToday = getHistory().filter(h => h.action === 'order' && h.closedAt && isToday(h.closedAt) && typeof h.realizedPL === 'number');
  if (!closedToday.length) return null;
  return Math.round(closedToday.reduce((sum, h) => sum + h.realizedPL, 0) * 100) / 100;
}

function logDecision(entry) {
  const history = [{ ...entry, at: Date.now() }, ...getHistory()].slice(0, HISTORY_LIMIT);
  cache.set(HISTORY_KEY, history, LONG_TTL);
  broadcast('trades', { history: history.slice(0, 20) });
  if (entry.action !== 'skip') log.info(`trade ${entry.action}: ${entry.symbol} ${entry.reason ?? ''}`);
  return history;
}

/**
 * Every order this build places gets a tradeId attached (Capital.com's
 * dealId) so its eventual outcome can be looked up once it's no longer
 * in the open-positions list. Entries without a tradeId (skips, errors)
 * are simply never resolved — a safe degradation, not a crash. Capital.com
 * has no single-trade lookup the way OANDA did, so this searches recent
 * transaction history instead and gives up after MAX_OUTCOME_ATTEMPTS
 * rather than retrying forever if that lookup never finds a match.
 */
export async function refreshClosedTrades() {
  const history = getHistory();
  const pending = history.filter(h => h.action === 'order' && h.tradeId && !h.outcome);
  if (!pending.length) return;

  const openDealIds = new Set((cache.getStale('capital:positions') ?? []).map(p => p.dealId));
  let changed = false;

  for (const entry of pending) {
    if (openDealIds.has(entry.tradeId)) continue; // still open — nothing to resolve yet

    entry.unresolvedAttempts = (entry.unresolvedAttempts ?? 0) + 1;
    const pnl = await capital.fetchClosedPnl(entry.tradeId);
    if (pnl != null) {
      entry.outcome = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven';
      entry.realizedPL = pnl;
      entry.closedAt = Date.now();
      changed = true;
    } else if (entry.unresolvedAttempts >= MAX_OUTCOME_ATTEMPTS) {
      entry.outcome = 'unknown';
      entry.realizedPL = null;
      entry.closedAt = Date.now();
      changed = true;
      log.warn(`trade outcome unresolved after ${MAX_OUTCOME_ATTEMPTS} attempts: ${entry.symbol} (${entry.tradeId})`);
    }
  }
  if (changed) {
    cache.set(HISTORY_KEY, history, LONG_TTL);
    broadcast('trades', { history: history.slice(0, 20), stats: getStats() });
  }
}

/** Win rate + net realized P&L across every resolved trade in the log. 'unknown' outcomes (lookup gave up) are excluded rather than guessed. */
export function getStats() {
  const closed = getHistory().filter(h => h.action === 'order' && h.outcome && h.outcome !== 'unknown');
  const wins = closed.filter(h => h.outcome === 'win').length;
  const losses = closed.filter(h => h.outcome === 'loss').length;
  const netRealizedPl = closed.reduce((sum, h) => sum + (h.realizedPL ?? 0), 0);
  return {
    closedCount: closed.length,
    wins,
    losses,
    winRatePct: closed.length ? Math.round((wins / closed.length) * 1000) / 10 : null,
    netRealizedPl: Math.round(netRealizedPl * 100) / 100
  };
}

export function supportedInstruments() {
  return Object.keys(CAPITAL_EPIC);
}

/** One-click, fixed-size BTCUSD smoke test for the configured Capital.com demo account. */
export async function placeDemoTestOrder(direction = 'BUY') {
  if (direction !== 'BUY' && direction !== 'SELL') {
    return { ok: false, error: 'Demo test direction must be BUY or SELL' };
  }

  const markets = await capital.searchMarkets('Bitcoin');
  const market = markets.find((row) => {
    const text = `${row.epic ?? ''} ${row.symbol ?? ''} ${row.instrumentName ?? ''}`.toLowerCase();
    return text.includes('bitcoin') || text.includes('btcusd');
  });
  if (!market?.epic) return { ok: false, error: 'Capital.com returned no Bitcoin market' };

  const price = await capital.fetchMarket(market.epic);
  if (!price) return { ok: false, error: `No live price for ${market.epic}` };

  const mid = (price.bid + price.offer) / 2;
  const size = 0.01;
  const stopLevel = round(direction === 'BUY' ? mid * 0.98 : mid * 1.02);
  const profitLevel = round(direction === 'BUY' ? mid * 1.02 : mid * 0.98);
  const result = await capital.placeMarketOrder({ epic: market.epic, direction, size, stopLevel, profitLevel });
  const tradeId = result.ok ? result.order?.dealId : undefined;
  logDecision({
    symbol: 'BTCUSD', instrument: market.epic, action: result.ok ? 'order' : 'error',
    reason: 'manual demo test order', direction: direction === 'BUY' ? 'Bullish' : 'Bearish',
    units: direction === 'BUY' ? size : -size, price: mid, stopPrice: stopLevel, targetPrice: profitLevel,
    tradeId, error: result.ok ? undefined : result.error
  });
  return { ok: result.ok, error: result.ok ? undefined : result.error, symbol: 'BTCUSD', epic: market.epic, size, price: mid, stopLevel, profitLevel, order: result.order };
}

/**
 * Poll pricing/account/positions from Capital.com and cache them — kept
 * separate from the decision loop below so the UI always shows current
 * account state even while trading is disabled.
 */
export async function refreshBroker() {
  const settings = getSettings();
  const epics = settings.allowedInstruments.map(s => CAPITAL_EPIC[s]).filter(Boolean);

  const [account, positions, ...markets] = await Promise.all([
    capital.fetchAccountSummary(),
    capital.fetchOpenPositions(),
    ...epics.map(e => capital.fetchMarket(e))
  ]);

  if (account) cache.set('capital:account', account, 60_000);
  if (positions) cache.set('capital:positions', positions, 60_000);
  const pricing = markets.filter(Boolean);
  if (pricing.length) cache.set('capital:pricing', pricing, 60_000);

  broadcast('trades', {
    account: cache.getStale('capital:account'),
    positions: cache.getStale('capital:positions'),
    settings
  });
}

/** The decision loop — runs on a slower interval than refreshBroker(), registered in lib/scheduler.js. */
export async function evaluateTrades() {
  const settings = getSettings();
  if (!settings.enabled) return;
  if (!config.keys.capital || !config.capital.identifier) return;

  const account = cache.getStale('capital:account');
  if (!account) { log.warn('trade: no Capital.com account data yet, skipping cycle'); return; }

  // Daily realized-loss circuit breaker, computed from today's already-resolved closed trades (see getDailyPl).
  const dailyPl = getDailyPl();
  if (dailyPl != null) {
    const lossPct = (-dailyPl / account.balance) * 100;
    if (lossPct >= config.trade.maxDailyLossPct) {
      tripKillSwitch(`daily loss limit hit (${lossPct.toFixed(2)}% >= ${config.trade.maxDailyLossPct}%)`);
      return;
    }
  }

  const positions = cache.getStale('capital:positions') ?? [];
  const openCount = positions.length;
  const risk = cache.getStale('risk') ?? { score: 50 };
  const cotMarkets = cache.getStale('cot')?.markets ?? {};
  const dxyChange = (cache.getStale('quotes') ?? []).find(q => q.symbol === 'DXY')?.change ?? 0;

  for (const symbol of settings.allowedInstruments) {
    const epic = CAPITAL_EPIC[symbol];
    if (!epic) continue; // not one of the instruments this build actually supports — allowlist, not a suggestion

    const already = positions.find(p => p.epic === epic);
    if (already) { logDecision({ symbol, action: 'skip', reason: 'position already open' }); continue; }
    if (openCount >= config.trade.maxOpenPositions) { logDecision({ symbol, action: 'skip', reason: 'max open positions reached' }); continue; }

    const priceRow = (cache.getStale('capital:pricing') ?? []).find(p => p.epic === epic);
    const prevClose = await capital.fetchPrevClose(epic);
    if (!priceRow || !prevClose) { logDecision({ symbol, action: 'skip', reason: 'no price data yet' }); continue; }

    const mid = (priceRow.bid + priceRow.offer) / 2;
    const change = ((mid - prevClose) / prevClose) * 100;
    const bias = computeBias(symbol, { quote: { price: mid, change }, risk, cot: cotMarkets[symbol], dollarChange: dxyChange });

    if (!bias || bias.direction === 'Neutral') { logDecision({ symbol, action: 'skip', reason: 'neutral bias', bias }); continue; }
    if (bias.confidence < settings.minConfidence) {
      logDecision({ symbol, action: 'skip', reason: `confidence ${bias.confidence}% below ${settings.minConfidence}% floor`, bias });
      continue;
    }

    const long = bias.direction === 'Bullish';
    const stopPrice = long ? bias.levels.support1 : bias.levels.resistance1;
    const targetPrice = long ? bias.levels.resistance2 : bias.levels.support2;
    const stopDistance = Math.abs(mid - stopPrice);
    if (!stopDistance) { logDecision({ symbol, action: 'skip', reason: 'zero stop distance' }); continue; }

    const riskAmount = account.balance * (settings.riskPct / 100);
    const size = Math.round((riskAmount / stopDistance) * 100) / 100;
    if (!size) { logDecision({ symbol, action: 'skip', reason: 'position size rounded to zero — risk % too small for this stop distance' }); continue; }

    const direction = long ? 'BUY' : 'SELL';
    const result = await capital.placeMarketOrder({ epic, direction, size, stopLevel: round(stopPrice), profitLevel: round(targetPrice) });
    const tradeId = result.ok ? result.order?.dealId : undefined;
    logDecision({
      symbol, instrument: epic, action: result.ok ? 'order' : 'error',
      direction: bias.direction, units: long ? size : -size, price: mid, stopPrice, targetPrice,
      confidence: bias.confidence, inputs: bias.inputs,
      tradeId, // used by refreshClosedTrades() to resolve win/loss later — absent if the confirm response shape didn't include a dealId
      error: result.ok ? undefined : result.error
    });
  }
}

function round(n) { return Math.round(n * 100000) / 100000; }
