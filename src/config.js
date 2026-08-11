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
    anthropic:  process.env.ANTHROPIC_API_KEY || null
  },

  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',

  refresh: {
    fast:  n(process.env.REFRESH_FAST, 15_000),    // prices
    slow:  n(process.env.REFRESH_SLOW, 300_000),   // news, calendar
    daily: n(process.env.REFRESH_DAILY, 3_600_000) // COT, FX reference
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
    interpret:   { keyless: false, enabled: !!config.keys.anthropic, needs: 'ANTHROPIC_API_KEY' }
  };
}
