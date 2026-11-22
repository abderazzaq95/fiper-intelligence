/**
 * Replays the live swing scanner day by day over recent history, in
 * dry-run, so the full alert → hold → exit cycle can be checked against
 * the backtest without waiting weeks for a live signal.
 *
 * npm run replay -- USTEC 180
 */
import { readFile } from 'node:fs/promises';
import { scanSwing } from '../src/signals/scanner.js';
import { loadDaily, completedDaily, backtestSwing, SWING_INSTRUMENTS } from '../src/signals/swing.js';

const key = process.argv[2] || 'USTEC';
const days = Number(process.argv[3] || 180);
const prof = JSON.parse(await readFile(new URL('../data/swing-profile.json', import.meta.url), 'utf8')).instruments[key];
const bars = completedDaily(await loadDaily(key));
const state = { lastBar: {}, open: [], closed: [] };
for (let end = bars.length - days; end <= bars.length; end++) {
  const out = [];
  await scanSwing(key, prof, state, out, bars.slice(0, end));
  for (const m of out) if (!m.startsWith('⏳')) console.log(`--- ${new Date(bars[end - 1].t).toISOString().slice(0, 10)}\n${m.replace(/<[^>]+>/g, '')}\n`);
}
const bt = backtestSwing(bars, SWING_INSTRUMENTS[key]).filter(t => t.t >= bars[bars.length - days].t);
console.log(`Replay closed ${state.closed.length} trades: ${state.closed.map(c => c.R.toFixed(2)).join(', ')}`);
console.log(`Backtest  same window: ${bt.length} trades: ${bt.map(t => t.R.toFixed(2)).join(', ')}  (backtest enters next open, live enters at close — small differences expected)`);
