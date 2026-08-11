/* Ported from fiper-terminal.html's ROUTES object + sidebar <nav> markup.
   Not its own file in the migration plan's file tree, but factored out
   here so TerminalShell, Sidebar and TopBar can all reference the same
   screen-key type and breadcrumb data without a circular import between
   TerminalShell.tsx (owns activeScreen state) and Sidebar.tsx/TopBar.tsx
   (need the same route list to render). */

export type ScreenKey =
  | 'home' | 'headlines' | 'calendar' | 'bias'
  | 'global' | 'flows' | 'cot' | 'forecasts'
  | 'candles' | 'backtest' | 'stocks' | 'crypto';

// [breadcrumb group, breadcrumb name]
export const ROUTES: Record<ScreenKey, [string, string]> = {
  home: ['Overview', 'Home'],
  headlines: ['Market Pulse', 'Live Headlines'],
  calendar: ['Market Pulse', 'Economic Calendar'],
  bias: ['Market Pulse', 'Daily Bias'],
  global: ['Markets', 'Global Markets'],
  flows: ['Markets', 'Capital Flows'],
  cot: ['Markets', 'COT Positioning'],
  forecasts: ['Markets', 'Price Forecasts'],
  candles: ['Research', 'Candle Analysis'],
  backtest: ['Research', 'Fundamental Backtesting'],
  stocks: ['Research', 'Stock Research'],
  crypto: ['Research', 'Crypto Macro'],
};

export interface NavItem {
  key: ScreenKey;
  icon: string;
  label: string;
  tag?: boolean; // headlines shows a live HIGH-impact count badge
}
export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { group: 'Market Pulse', items: [
    { key: 'home', icon: '◉', label: 'Home' },
    { key: 'headlines', icon: '◈', label: 'Live Headlines', tag: true },
    { key: 'calendar', icon: '▤', label: 'Economic Calendar' },
    { key: 'bias', icon: '◆', label: 'Daily Bias' },
  ] },
  { group: 'Markets', items: [
    { key: 'global', icon: '▦', label: 'Global Markets' },
    { key: 'flows', icon: '⇄', label: 'Capital Flows' },
    { key: 'cot', icon: '▥', label: 'COT Positioning' },
    { key: 'forecasts', icon: '◇', label: 'Price Forecasts' },
  ] },
  { group: 'Research', items: [
    { key: 'candles', icon: '▧', label: 'Candle Analysis' },
    { key: 'backtest', icon: '⌗', label: 'Backtesting' },
    { key: 'stocks', icon: '◫', label: 'Stock Research' },
    { key: 'crypto', icon: '₿', label: 'Crypto Macro' },
  ] },
];
