/* Symbol/interval mapping for the TradingView Advanced Chart widget
   (ChartWidget.tsx). Kept separate from candles.ts/bias.ts so those
   files' own asset keys (CNDL_ASSETS, BIAS_LIST) stay untouched — this
   is purely a lookup from the app's existing asset symbols to the
   ticker strings TradingView's charting library resolves.

   Best-effort mapping, not independently verified against TradingView's
   live symbol database (no network access to confirm each ticker
   resolves) — NQUSD/XAUUSD/BTCUSD came directly from the spec; the rest
   (ESUSD, USOIL, DXY, DAX) follow the same vendor conventions. If any
   of these fail to resolve in the widget, the fix is a one-line edit
   here, nothing else touches this table. */
export const TV_SYMBOL_MAP: Record<string, string> = {
  // Candle Analysis screen (crypto — CNDL_ASSETS)
  BTCUSD: 'BINANCE:BTCUSDT',
  ETHUSD: 'BINANCE:ETHUSDT',
  SOLUSD: 'BINANCE:SOLUSDT',
  XRPUSD: 'BINANCE:XRPUSDT',
  // Daily Bias screen (BIAS_LIST) — index tickers use Capital.com's CFD
  // symbols. Both the TVC vendor (TVC:NDX/TVC:SPX/TVC:DAX) and
  // exchange-native tickers (NASDAQ:NDX/SP:SPX/XETR:DAX) were tried
  // first and each failed on the free widget in one way or another
  // ("doesn't exist", the "only available on TradingView.com"
  // restriction notice, or — for XETR:DAX — a real symbol that's
  // restricted to D/W/M intervals only, no 1H). CAPITALCOM:* resolves
  // reliably across all intervals including 1H. Commodity/FX
  // (XAUUSD/USOIL/DXY) stay on TVC — those were confirmed clean
  // throughout and are left untouched.
  NQUSD: 'CAPITALCOM:NAS100',
  ESUSD: 'CAPITALCOM:US500',
  YMUSD: 'CAPITALCOM:US30',
  XAUUSD: 'TVC:GOLD',
  USOIL: 'TVC:USOIL',
  DXY: 'TVC:DXY',
  DAX: 'CAPITALCOM:GER40',
};

export function tvSymbol(asset: string): string {
  return TV_SYMBOL_MAP[asset] || `BINANCE:${asset}T`;
}

// App timeframe code -> TradingView interval code.
const TF_MAP: Record<string, string> = { '15m': '15', '1h': '60', '4h': '240', '1d': 'D' };

export function tvInterval(tf: string): string {
  return TF_MAP[tf] || '60';
}
