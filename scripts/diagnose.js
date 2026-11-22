/**
 * Research diagnostics: raw edge per strategy × reward multiple × session
 * over the full history, and whether the model's probabilities are
 * calibrated out-of-sample. Use this to decide what to change; never
 * use it to pick settings (that would be fitting to the holdout).
 *
 * npm run diagnose -- XAUUSD
 */
import { INSTRUMENTS } from '../src/signals/instruments.js';
import { loadHistory } from '../src/signals/data.js';
import { computeIndicators, WARMUP } from '../src/signals/indicators.js';
import { STRATEGIES } from '../src/signals/strategies.js';
import { sessionOf } from '../src/signals/features.js';
import { generateCandidates, takeSequential, stats } from '../src/signals/backtest.js';
import { train, predict } from '../src/signals/model.js';

const key = process.argv[2] || 'XAUUSD';
const bars = await loadHistory(key);
const x = computeIndicators(bars);
const pct = v => `${(v * 100).toFixed(0)}%`.padStart(4);
const row = (label, s) => `${label.padEnd(22)} n=${String(s.n).padStart(4)} win ${pct(s.winRate)} exp ${s.expectancyR.toFixed(3).padStart(6)}R PF ${s.profitFactor.toFixed(2)}`;

for (const tp of [0.6, 1.0, 1.5, 2.0]) {
  const c = generateCandidates(bars, x, key, tp);
  console.log(`\n== ${key} target ${tp}R  (${c.length} raw candidates)`);
  for (const s of STRATEGIES) {
    const cs = c.filter(k => k.strategy === s.id).map(k => ({ ...k, p: 0 }));
    console.log(row(s.id, stats(takeSequential(cs))));
    for (const sess of ['asia', 'london', 'ny', 'late']) {
      const st = stats(takeSequential(cs.filter(k => sessionOf(k.t) === sess)));
      if (st.n >= 20) console.log('  ' + row(sess, st));
    }
  }
  // Calibration: a model trained on the first half, scored on the second
  const mid = WARMUP + Math.floor((bars.length - WARMUP) / 2);
  const tr = c.filter(k => k.exitIdx < mid), te = c.filter(k => k.i >= mid);
  const m = train(tr.map(k => k.x), tr.map(k => k.win));
  const scored = te.map(k => ({ ...k, p: predict(m, k.x) }));
  const base = te.reduce((s, k) => s + k.win, 0) / te.length;
  console.log(`  calibration (2nd half, base win ${pct(base)}):`);
  for (const [lo, hi] of [[0, 0.4], [0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 1]]) {
    const b = scored.filter(k => k.p >= lo && k.p < hi);
    if (b.length) console.log(`    p ${lo.toFixed(1)}-${hi.toFixed(1)}: n=${String(b.length).padStart(4)} actual win ${pct(b.reduce((s, k) => s + k.win, 0) / b.length)} avg R ${(b.reduce((s, k) => s + k.R, 0) / b.length).toFixed(3)}`);
  }
}
