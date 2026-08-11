export interface NewsItem {
  impact: string;
  time: string;
  headline: string;
  summary: string;
  assets: { label: string; dir: 'up' | 'down' }[];
}

export const newsItems: NewsItem[] = [
  {
    impact: 'HIGH IMPACT',
    time: 'just now',
    headline: 'FED CHAIR: RATE CUTS REMAIN DATA-DEPENDENT AMID INFLATION RISKS',
    summary:
      'Powell signals cautious stance, reducing immediate rate-cut expectations and supporting USD strength.',
    assets: [
      { label: 'USD ↑', dir: 'up' },
      { label: 'XAUUSD ↓', dir: 'down' },
      { label: 'NQUSD ↓', dir: 'down' },
    ],
  },
  {
    impact: 'HIGH IMPACT',
    time: '2 min ago',
    headline: 'ECB LAGARDE: EUROZONE GROWTH WEAKER THAN PROJECTED IN Q2',
    summary:
      'Lagarde confirms downside growth surprises, increasing probability of ECB easing before year end.',
    assets: [
      { label: 'EURUSD ↓', dir: 'down' },
      { label: 'DAX ↑', dir: 'up' },
    ],
  },
  {
    impact: 'HIGH IMPACT',
    time: '5 min ago',
    headline: 'US CPI BEATS EXPECTATIONS AT 0.4% M/M VS 0.2% FORECAST',
    summary:
      'Hotter-than-expected inflation print reduces rate-cut window. Dollar demand surges across the board.',
    assets: [
      { label: 'DXY ↑', dir: 'up' },
      { label: 'EURUSD ↓', dir: 'down' },
      { label: 'XAUUSD ↓', dir: 'down' },
    ],
  },
  {
    impact: 'HIGH IMPACT',
    time: '12 min ago',
    headline: 'OPEC+ CONFIRMS PRODUCTION CUT EXTENSION THROUGH Q3 2026',
    summary:
      'Supply-side tightening confirmed. Crude oil supported near key resistance. Watch energy sector.',
    assets: [
      { label: 'OIL ↑', dir: 'up' },
      { label: 'USD ↑', dir: 'up' },
    ],
  },
  {
    impact: 'HIGH IMPACT',
    time: '18 min ago',
    headline: 'BOJ SIGNALS POTENTIAL RATE HIKE IF WAGE DATA CONFIRMS TREND',
    summary:
      'Hawkish shift from BOJ. Yen strengthening across all pairs. USDJPY selling pressure elevated.',
    assets: [
      { label: 'USDJPY ↓', dir: 'down' },
      { label: 'JPY ↑', dir: 'up' },
    ],
  },
  {
    impact: 'HIGH IMPACT',
    time: '25 min ago',
    headline: 'TRUMP ANNOUNCES NEW TARIFFS ON TECH IMPORTS FROM CHINA',
    summary:
      'Escalation in trade tensions. Tech sector under pressure, semiconductor names leading losses.',
    assets: [
      { label: 'NQUSD ↓', dir: 'down' },
      { label: 'USD ↑', dir: 'up' },
    ],
  },
];
