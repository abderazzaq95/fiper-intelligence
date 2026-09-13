import 'dotenv/config';

const n = (v, d) => (v ? Number(v) : d);

export const config = {
  port: n(process.env.PORT, 8080),
  corsOrigins: (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()),

  keys: {
    twelvedata: process.env.TWELVEDATA_KEY || null,
    marketaux:  process.env.MARKETAUX_KEY  || null,
    finnhub:    process.env.FINNHUB_KEY    || null,
    fmp:        process.env.FMP_KEY        || null,
    te:         process.env.TRADING_ECONOMICS_KEY || null,
    anthropic:  process.env.ANTHROPIC_API_KEY || null,
    capital:    process.env.CAPITAL_API_KEY || null
  },

  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',

  refresh: {
    fast:  n(process.env.REFRESH_FAST, 15_000),    // prices
    slow:  n(process.env.REFRESH_SLOW, 300_000),   // news, calendar
    daily: n(process.env.REFRESH_DAILY, 3_600_000), // COT, FX reference
    broker: n(process.env.REFRESH_BROKER, 20_000),    // account/positions/pricing poll
    tradeEval: n(process.env.TRADE_EVAL_INTERVAL, 5 * 60_000) // decision loop — deliberately not tick-fast
  },

  /**
   * "Trade for Me" — paper-trading auto-execution against a Capital.com
   * demo account. Deliberately no live-host config anywhere here; going
   * live is a future, separately-considered change, not a flag.
   */
  capital: {
    identifier: process.env.CAPITAL_IDENTIFIER || null, // login email
    password: process.env.CAPITAL_PASSWORD || null
    // demo only — see providers/capital.js
  },
  trade: {
    enabledDefault: (process.env.TRADE_ENABLED || 'false').toLowerCase() === 'true',
    maxRiskPct:        n(process.env.TRADE_MAX_RISK_PCT, 1),
    maxDailyLossPct:   n(process.env.TRADE_MAX_DAILY_LOSS_PCT, 3),
    maxOpenPositions:  n(process.env.TRADE_MAX_OPEN_POSITIONS, 3),
    minConfidence:     n(process.env.TRADE_MIN_CONFIDENCE, 40),
    // canonical app symbols (bias.js/cftc.js convention — no underscore), mapped to Capital.com epics in services/autotrader.js
    allowedInstruments: (process.env.TRADE_ALLOWED_INSTRUMENTS || 'XAUUSD,EURUSD,GBPUSD')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
    apiSecret: process.env.TRADE_API_SECRET || null
  },

  // assets the terminal tracks — single source of truth
  universe: {
    crypto:  ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'ADAUSDT'],
    indices: ['NDX', 'SPX', 'DJI', 'DAX'],
    commodities: ['XAU/USD', 'XAG/USD', 'WTI/USD'],
    fx: ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']
  }
};

/** Which providers can actually run right now. Surfaced at /api/status. */
export function providerHealth() {
  return {
    binance:     { keyless: true,  enabled: true },
    frankfurter: { keyless: true,  enabled: true },
    cftc:        { keyless: true,  enabled: true },
    quotes:      { keyless: false, enabled: !!config.keys.twelvedata, needs: 'TWELVEDATA_KEY' },
    news:        { keyless: false, enabled: !!(config.keys.marketaux || config.keys.finnhub), needs: 'MARKETAUX_KEY or FINNHUB_KEY' },
    calendar:    { keyless: false, enabled: !!(config.keys.fmp || config.keys.te), needs: 'FMP_KEY or TRADING_ECONOMICS_KEY' },
    interpret:   { keyless: false, enabled: !!config.keys.anthropic, needs: 'ANTHROPIC_API_KEY' },
    capital:     { keyless: false, enabled: !!(config.keys.capital && config.capital.identifier && config.capital.password), needs: 'CAPITAL_API_KEY, CAPITAL_IDENTIFIER and CAPITAL_PASSWORD' }
  };
}
