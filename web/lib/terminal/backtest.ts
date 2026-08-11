/* ══════════ FUNDAMENTAL BACKTESTING ══════════
   Historical event reactions, ported verbatim from fiper-terminal.html.
   Wire a real database of releases + price reactions to replace the
   modelled set (see CONFIG for the same "swap in a live feed" pattern
   used elsewhere).

   CLAUDE.md's "statistical honesty in backtesting" constraint lives in
   the `reliable = n >= 8` gate below — kept verbatim, not softened.

   Note: runBacktest() reseeds the SHARED module-level PRNG (rng.ts) from
   a hash of its own inputs, exactly like the original did with the
   global `_seed`. That's a deliberate (if quirky) part of the original:
   backtests are deterministic per-query, but running one also mutates
   the sequence for whatever modelled generation happens afterwards.
   Preserved as-is rather than "fixed", per the port's verbatim-logic
   requirement. */

import { between, rnd, setSeed } from './rng';

export interface BTEvent {
  id: string;
  n: string;
  ccy: string;
  freq: number;
  vol: number;
}

export const BT_ASSETS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'NQUSD', 'ESUSD', 'USOIL', 'BTCUSD'];

export const BT_EVENTS: BTEvent[] = [
  { id: 'cpi', n: 'US Core CPI m/m', ccy: 'USD', freq: 12, vol: 1.0 },
  { id: 'nfp', n: 'US Non-Farm Payrolls', ccy: 'USD', freq: 12, vol: 1.4 },
  { id: 'fomc', n: 'FOMC Rate Decision', ccy: 'USD', freq: 8, vol: 1.6 },
  { id: 'ism', n: 'US ISM Manufacturing', ccy: 'USD', freq: 12, vol: 0.6 },
  { id: 'ecb', n: 'ECB Rate Decision', ccy: 'EUR', freq: 8, vol: 1.1 },
  { id: 'boe', n: 'BoE Rate Decision', ccy: 'GBP', freq: 8, vol: 1.0 },
  { id: 'boj', n: 'BoJ Policy Statement', ccy: 'JPY', freq: 8, vol: 1.3 },
  { id: 'gdp', n: 'US GDP q/q Advance', ccy: 'USD', freq: 4, vol: 0.9 },
  { id: 'pce', n: 'US Core PCE m/m', ccy: 'USD', freq: 12, vol: 0.8 },
  { id: 'eia', n: 'EIA Crude Inventories', ccy: 'USD', freq: 52, vol: 0.5 },
];

// how strongly each asset responds to a USD-positive surprise
const BT_BETA: Record<string, number> = { EURUSD: -1.0, GBPUSD: -0.9, USDJPY: 1.0, XAUUSD: -0.85, NQUSD: -0.7, ESUSD: -0.6, USOIL: -0.4, BTCUSD: -0.55 };

export interface BacktestRow {
  date: string;
  beat: boolean;
  surprise: number;
  move: number;
}

export interface BacktestResult {
  asset: string;
  ev: BTEvent;
  cond: 'beat' | 'miss' | 'any';
  win: number;
  lookback: number;
  rows: BacktestRow[];
  n: number;
  avg: number;
  winRate: number;
  best: number;
  worst: number;
  sd: number;
  maxAbs: number;
  reliable: boolean;
}

export function runBacktest(asset: string, evId: string, cond: 'beat' | 'miss' | 'any', win: number): BacktestResult {
  const ev = BT_EVENTS.find((e) => e.id === evId) ?? BT_EVENTS[0];
  setSeed([...asset + evId + cond + win].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));

  const lookback = 3; // years of history
  const total = Math.round(ev.freq * lookback);
  const rows: BacktestRow[] = [];
  for (let i = 0; i < total; i++) {
    const beat = rnd() > 0.5;
    if (cond === 'beat' && !beat) continue;
    if (cond === 'miss' && beat) continue;
    const d = new Date();
    d.setMonth(d.getMonth() - Math.round(i * (12 / ev.freq)));
    const surprise = (beat ? 1 : -1) * between(0.1, 0.9);
    const timeScale = Math.sqrt(win / 1440);
    const beta = BT_BETA[asset] ?? 0.5;
    const usdPositive = ev.ccy === 'USD' ? surprise : -surprise * 0.6;
    const move = usdPositive * beta * ev.vol * timeScale * between(0.5, 1.8) + between(-0.35, 0.35) * timeScale; // noise
    rows.push({ date: d.toISOString().slice(0, 10), beat, surprise, move });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));

  const n = rows.length;
  const moves = rows.map((r) => r.move);
  const avg = moves.reduce((a, b) => a + b, 0) / (n || 1);
  const wins = moves.filter((m) => Math.sign(m) === Math.sign(avg) && m !== 0).length;
  const winRate = n ? (wins / n) * 100 : 0;
  const best = Math.max(...moves, 0);
  const worst = Math.min(...moves, 0);
  const sd = Math.sqrt(moves.reduce((a, m) => a + (m - avg) ** 2, 0) / (n || 1));
  const maxAbs = Math.max(...moves.map(Math.abs), 0.01);

  // CLAUDE.md "statistical honesty in backtesting": below 8 matching
  // instances the result is not presented as statistically reliable.
  const reliable = n >= 8;

  return { asset, ev, cond, win, lookback, rows, n, avg, winRate, best, worst, sd, maxAbs, reliable };
}
