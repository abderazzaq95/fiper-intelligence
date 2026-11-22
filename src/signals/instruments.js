/**
 * The three instruments the signal engine trades, and how each one is
 * sourced and costed.
 *
 * Price feeds are free proxies, not the Exness quote itself:
 *   - XAUUSD uses COMEX gold futures (GC=F). Futures trade a few dollars
 *     away from spot (the "basis"), so signals state stops and targets as
 *     DISTANCES from entry as well as levels — distances transfer to the
 *     Exness chart, levels do not.
 *   - USTEC uses Nasdaq-100 futures (NQ=F), which is what Exness USTEC
 *     tracks, so levels are close but still not identical.
 *   - BTCUSD uses Binance BTCUSDT spot, which leads most CFD quotes.
 *
 * `cost` is a round-trip spread + slippage estimate in price units, set
 * a little worse than Exness Standard typical spreads on purpose: a
 * backtest that is profitable only at best-case spread is not profitable.
 *
 * `contract` is units per 1.00 lot, used for lot sizing. Exness symbol
 * specs vary by account type — verify in MT5 (symbol → Specification).
 */
export const INSTRUMENTS = {
  XAUUSD: {
    name: 'Gold',
    source: 'yahoo', symbol: 'GC=F', range: '2y',
    decimals: 2, cost: 0.40, contract: 100
  },
  USTEC: {
    name: 'Nasdaq 100',
    source: 'yahoo', symbol: 'NQ=F', range: '2y',
    decimals: 2, cost: 2.5, contract: 1
  },
  BTCUSD: {
    name: 'Bitcoin',
    source: 'binance', symbol: 'BTCUSDT', days: 1095,
    decimals: 2, costPct: 0.0004, contract: 1
  }
};

export const costFor = (inst, price) => inst.costPct ? price * inst.costPct : inst.cost;

export const INSTRUMENT_KEYS = Object.keys(INSTRUMENTS);
