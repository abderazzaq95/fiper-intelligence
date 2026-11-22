import { STRATEGIES } from './strategies.js';

/**
 * Context features for the probability model. Each is oriented by trade
 * direction ("with the trade" is positive) so one model serves longs and
 * shorts, and each is scaled by ATR so gold, Nasdaq and Bitcoin share a
 * vocabulary. The names are human-readable because they are also how a
 * signal explains itself in Telegram.
 */
export const SESSIONS = [
  { id: 'asia',   from: 0,  to: 7 },
  { id: 'london', from: 7,  to: 12 },
  { id: 'ny',     from: 12, to: 17 },
  { id: 'late',   from: 17, to: 24 }
];
export const sessionOf = t => {
  const h = new Date(t).getUTCHours();
  return SESSIONS.find(s => h >= s.from && h < s.to).id;
};

const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const FEATURES = [
  'trendAligned',     // 50/200 EMA agrees with the trade
  'trendSlope',       // 200 EMA slope over a day, in ATR, with the trade
  'extension',        // distance from the 200 EMA in ATR, with the trade
  'adx',              // trend strength
  'rsiTilt',          // RSI pushing with the trade
  'volRank',          // ATR percentile over ~8 days
  'momentum24',       // last 24 bars' move in ATR, with the trade
  'barBody',          // signal-bar body / range
  'closeStrength',    // how close the signal bar closed to its extreme in the trade's favour
  'stopSize',         // stop distance in ATR — wider stops survive noise
  'dailyTrend',       // price vs ~20-day EMA, with the trade
  'expansion',        // current ATR vs its slow average — is volatility waking up?
  'sessLondon', 'sessNY', 'sessAsia',
  ...STRATEGIES.slice(1).map(s => `strat${s.id}`)
];

export function featureVector(bars, x, i, setup, entry) {
  const b = bars[i], a = x.atr[i], d = setup.dir, r = b.h - b.l || 1e-9;
  const sess = sessionOf(b.t);
  return [
    Math.sign(x.ema50[i] - x.ema200[i]) * d,
    clip((x.ema200[i] - x.ema200[i - 24]) / a * d, -3, 3),
    clip((b.c - x.ema200[i]) / a * d, -8, 8),
    x.adx[i] / 50,
    (x.rsi[i] - 50) / 50 * d,
    x.atrRank[i],
    clip((b.c - bars[i - 24].c) / a * d, -8, 8),
    Math.abs(b.c - b.o) / r,
    d > 0 ? (b.c - b.l) / r : (b.h - b.c) / r,
    clip(Math.abs(entry - setup.stop) / a, 0, 4),
    Math.sign(b.c - x.ema480[i]) * d,
    clip(a / x.atrSlow[i], 0, 3),
    sess === 'london' ? 1 : 0, sess === 'ny' ? 1 : 0, sess === 'asia' ? 1 : 0,
    ...STRATEGIES.slice(1).map(s => (setup.strategy === s.id ? 1 : 0))
  ];
}

const LABELS = {
  trendAligned: ['with the higher-timeframe trend', 'against the higher-timeframe trend'],
  trendSlope: ['200 EMA sloping with the trade', '200 EMA sloping against the trade'],
  extension: ['price extended in trade direction', 'price stretched away — room to snap back'],
  adx: ['strong trend (ADX)', 'quiet, ranging market (ADX)'],
  rsiTilt: ['RSI momentum supports it', 'RSI not yet confirming'],
  volRank: ['volatility elevated', 'volatility compressed'],
  momentum24: ['24h momentum with the trade', '24h move against — reversal setup'],
  barBody: ['decisive signal candle', 'indecisive signal candle'],
  closeStrength: ['candle closed near its extreme', 'weak close on signal candle'],
  stopSize: ['stop placed beyond noise', 'tight stop'],
  dailyTrend: ['daily trend agrees', 'counter to the daily trend'],
  expansion: ['volatility expanding', 'volatility contracting'],
  sessLondon: ['London session', 'outside London session'],
  sessNY: ['New York session', 'outside New York session'],
  sessAsia: ['Asian session', 'outside Asian session']
};

/** Plain-English reason for a feature's contribution sign. */
export function describe(name, contribution) {
  const pair = LABELS[name];
  if (!pair) return null; // strategy one-hots explain themselves via the strategy name
  return contribution >= 0 ? pair[0] : pair[1];
}
