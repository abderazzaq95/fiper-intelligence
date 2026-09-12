import { cache } from '../lib/cache.js';
import { log } from '../lib/logger.js';
import { config } from '../config.js';
import { computeBias } from './bias.js';
import * as oanda from '../providers/oanda.js';
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
 * Paper account only. No live OANDA host exists anywhere in this file
 * or in providers/oanda.js — see CLAUDE.md.
 */

// canonical app symbol (matches bias.js/cftc.js/interpret.js convention) -> OANDA instrument code
const OANDA_INSTRUMENT = {
  XAUUSD: 'XAU_USD',
  XAGUSD: 'XAG_USD',
  EURUSD: 'EUR_USD',
  GBPUSD: 'GBP_USD',
  USDJPY: 'USD_JPY',
  AUDUSD: 'AUD_USD',
  USDCAD: 'USD_CAD',
  USDCHF: 'USD_CHF',
  NZDUSD: 'NZD_USD'
};

const SETTINGS_KEY = 'trade:settings';
const HISTORY_KEY = 'trade:history';
const HISTORY_LIMIT = 200;
const LONG_TTL = 365 * 24 * 3600_000; // settings/history — not a real cache, just this backend's only persistence mechanism (see CLAUDE.md Redis/Postgres roadmap)

function defaultSettings() {
  return {
    enabled: config.trade.enabledDefault,
    riskPct: config.trade.maxRiskPct,
    minConfidence: config.trade.minConfidence,
    allowedInstruments: config.trade.allowedInstruments.filter(s => OANDA_INSTRUMENT[s]),
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
  if ('minConfidence' in patch) next.minConfidence = clamp(Number(patch.minConfidence), 50, 95);
  if ('allowedInstruments' in patch && Array.isArray(patch.allowedInstruments)) {
    next.allowedInstruments = patch.allowedInstruments.filter(s => OANDA_INSTRUMENT[s]);
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

/** Today's realized P&L, derived the same way evaluateTrades()'s circuit breaker computes it. Null until a baseline exists (first eval cycle of the day). */
export function getDailyPl() {
  const account = cache.getStale('oanda:account');
  const baseline = cache.get('oanda:dayBaseline');
  const today = new Date().toISOString().slice(0, 10);
  if (!account || !baseline || baseline.day !== today) return null;
  return account.pl - baseline.pl;
}

function logDecision(entry) {
  const history = [{ ...entry, at: Date.now() }, ...getHistory()].slice(0, HISTORY_LIMIT);
  cache.set(HISTORY_KEY, history, LONG_TTL);
  broadcast('trades', { history: history.slice(0, 20) });
  if (entry.action !== 'skip') log.info(`trade ${entry.action}: ${entry.symbol} ${entry.reason ?? ''}`);
  return history;
}

export function supportedInstruments() {
  return Object.keys(OANDA_INSTRUMENT);
}

/**
 * Poll pricing/account/positions from OANDA and cache them — kept
 * separate from the decision loop below so the UI always shows current
 * account state even while trading is disabled.
 */
export async function refreshOanda() {
  const settings = getSettings();
  const instruments = settings.allowedInstruments.map(s => OANDA_INSTRUMENT[s]).filter(Boolean);

  const [account, positions, pricing] = await Promise.all([
    oanda.fetchAccountSummary(),
    oanda.fetchOpenPositions(),
    instruments.length ? oanda.fetchPricing(instruments) : Promise.resolve(null)
  ]);

  if (account) cache.set('oanda:account', account, 60_000);
  if (positions) cache.set('oanda:positions', positions, 60_000);
  if (pricing) cache.set('oanda:pricing', pricing, 60_000);

  broadcast('trades', {
    account: cache.getStale('oanda:account'),
    positions: cache.getStale('oanda:positions'),
    settings
  });
}

/** The decision loop — runs on a slower interval than refreshOanda(), registered in lib/scheduler.js. */
export async function evaluateTrades() {
  const settings = getSettings();
  if (!settings.enabled) return;
  if (!config.keys.oanda || !config.oanda.accountId) return;

  const account = cache.getStale('oanda:account');
  if (!account) { log.warn('trade: no OANDA account data yet, skipping cycle'); return; }

  // Daily realized-loss circuit breaker. OANDA's account.pl is a lifetime
  // counter, so the first observation each UTC day becomes the baseline
  // and everything after is compared against it.
  const today = new Date().toISOString().slice(0, 10);
  const baseline = cache.get('oanda:dayBaseline');
  if (!baseline || baseline.day !== today) {
    cache.set('oanda:dayBaseline', { day: today, pl: account.pl }, 25 * 3600_000);
  } else {
    const dailyPl = account.pl - baseline.pl;
    const lossPct = (-dailyPl / account.balance) * 100;
    if (lossPct >= config.trade.maxDailyLossPct) {
      tripKillSwitch(`daily loss limit hit (${lossPct.toFixed(2)}% >= ${config.trade.maxDailyLossPct}%)`);
      return;
    }
  }

  const positions = cache.getStale('oanda:positions') ?? [];
  const openCount = positions.filter(p => p.longUnits || p.shortUnits).length;
  const risk = cache.getStale('risk') ?? { score: 50 };
  const cotMarkets = cache.getStale('cot')?.markets ?? {};
  const dxyChange = (cache.getStale('quotes') ?? []).find(q => q.symbol === 'DXY')?.change ?? 0;

  for (const symbol of settings.allowedInstruments) {
    const instrument = OANDA_INSTRUMENT[symbol];
    if (!instrument) continue; // not one of the instruments this build actually supports — allowlist, not a suggestion

    const already = positions.find(p => p.instrument === instrument && (p.longUnits || p.shortUnits));
    if (already) { logDecision({ symbol, action: 'skip', reason: 'position already open' }); continue; }
    if (openCount >= config.trade.maxOpenPositions) { logDecision({ symbol, action: 'skip', reason: 'max open positions reached' }); continue; }

    const priceRow = (cache.getStale('oanda:pricing') ?? []).find(p => p.instrument === instrument);
    const prevClose = await oanda.fetchPrevClose(instrument);
    if (!priceRow || !prevClose) { logDecision({ symbol, action: 'skip', reason: 'no price data yet' }); continue; }

    const mid = (priceRow.bid + priceRow.ask) / 2;
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
    let units = Math.floor(riskAmount / stopDistance);
    if (!long) units = -units;
    if (!units) { logDecision({ symbol, action: 'skip', reason: 'position size rounded to zero — risk % too small for this stop distance' }); continue; }

    const result = await oanda.placeMarketOrder({ instrument, units, stopLossPrice: round(stopPrice), takeProfitPrice: round(targetPrice) });
    logDecision({
      symbol, instrument, action: result.ok ? 'order' : 'error',
      direction: bias.direction, units, price: mid, stopPrice, targetPrice,
      confidence: bias.confidence, inputs: bias.inputs,
      error: result.ok ? undefined : result.error
    });
  }
}

function round(n) { return Math.round(n * 100000) / 100000; }
