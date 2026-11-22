/**
 * npm run gold:research [-- LORB,PDS]
 *
 * For each gold playbook: run every parameter combination over 10 years
 * of minute data, pick the best on 2016–2021 ONLY, then show — without
 * re-choosing anything — how those exact settings did in 2022–2023
 * (validation) and 2024–2026 (holdout), plus year by year.
 *
 * A playbook counts as an edge only if it is positive in validation AND
 * holdout AND in most individual years. Gold's 2024–26 bull run flatters
 * anything long-biased, which is why the per-year view matters.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { loadM1 } from '../../src/signals/gold/m1.js';
import { buildContext, yearOf } from '../../src/signals/gold/context.js';
import { GOLD_STRATEGIES, combos } from '../../src/signals/gold/strategies.js';
import { wilsonLower } from '../../src/signals/model.js';

const SPLIT = { dev: [2016, 2021], val: [2022, 2023], hold: [2024, 2100] };
const MIN_DEV_TRADES = 150;
const pct = v => `${(v * 100).toFixed(1)}%`;
const f3 = v => (Number.isFinite(v) ? v.toFixed(3) : '∞');

function stats(ts) {
  const n = ts.length;
  if (!n) return { n: 0, winRate: 0, winLow: 0, exp: 0, pf: 0, t: 0, maxDD: 0, sumR: 0 };
  const wins = ts.filter(t => t.R > 0).length;
  const sumR = ts.reduce((s, t) => s + t.R, 0), mean = sumR / n;
  const sd = Math.sqrt(ts.reduce((s, t) => s + (t.R - mean) ** 2, 0) / Math.max(1, n - 1));
  const gross = ts.filter(t => t.R > 0).reduce((s, t) => s + t.R, 0);
  const loss = -ts.filter(t => t.R < 0).reduce((s, t) => s + t.R, 0);
  let eq = 0, peak = 0, dd = 0;
  for (const t of ts) { eq += t.R; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
  return { n, winRate: wins / n, winLow: wilsonLower(wins, n), exp: mean, pf: loss ? gross / loss : Infinity, t: sd ? mean / sd * Math.sqrt(n) : 0, maxDD: dd, sumR };
}
const inYears = (ts, [a, b]) => ts.filter(t => { const y = yearOf(t.entryT); return y >= a && y <= b; });

const only = process.argv[2]?.split(',');
console.time('load');
const m = await loadM1();
const ctx = buildContext(m);
console.timeEnd('load');
console.log(`${m.n.toLocaleString()} minutes, ${ctx.d.n} gold days, ${new Date(m.t[0] * 1000).toISOString().slice(0, 10)} → ${new Date(m.t[m.n - 1] * 1000).toISOString().slice(0, 10)}\n`);

const report = ['# XAUUSD playbook research', '', `Minute bid/ask data ${new Date(m.t[0] * 1000).toISOString().slice(0, 10)} → ${new Date(m.t[m.n - 1] * 1000).toISOString().slice(0, 10)}. Fills at real ask/bid, stop first on ambiguous minutes, 0.05 stop slippage. Parameters chosen on 2016–2021 only.`, ''];
const profile = {};

for (const S of GOLD_STRATEGIES.filter(s => !only || only.includes(s.id))) {
  const rows = [];
  for (const p of combos(S.grid)) {
    const ts = S.run(ctx, p);
    rows.push({ p, ts, dev: stats(inYears(ts, SPLIT.dev)), val: stats(inYears(ts, SPLIT.val)), hold: stats(inYears(ts, SPLIT.hold)) });
  }
  // Rank on development only, by t-statistic: rewards an edge that is both large and consistent
  const ranked = rows.filter(r => r.dev.n >= MIN_DEV_TRADES).sort((a, b) => b.dev.t - a.dev.t);
  const best = ranked[0];
  const line = (lab, s) => `${lab.padEnd(5)} n=${String(s.n).padStart(4)} win ${pct(s.winRate).padStart(6)} exp ${f3(s.exp).padStart(7)}R PF ${f3(s.pf).padStart(6)} t=${s.t.toFixed(2).padStart(5)} DD ${s.maxDD.toFixed(1)}R`;
  console.log(`== ${S.id} ${S.name} (${rows.length} combos)`);
  report.push(`## ${S.id} — ${S.name}`, '', `${rows.length} parameter combinations tested.`, '');
  if (!best) { console.log('  no combination reached the minimum trade count\n'); report.push('No combination reached the minimum trade count.', ''); continue; }

  const years = {};
  for (const t of best.ts) (years[yearOf(t.entryT)] ??= []).push(t);
  const yearStats = Object.entries(years).map(([y, ts]) => [y, stats(ts)]);
  const posYears = yearStats.filter(([, s]) => s.exp > 0).length;
  const edge = best.dev.exp > 0 && best.val.exp > 0 && best.hold.exp > 0 && posYears >= Math.ceil(yearStats.length * 0.7);

  console.log(`  best on 2016–21: ${JSON.stringify(best.p)}`);
  console.log('  ' + line('dev', best.dev)); console.log('  ' + line('val', best.val)); console.log('  ' + line('hold', best.hold));
  console.log(`  years positive: ${posYears}/${yearStats.length}  →  ${edge ? 'EDGE HOLDS' : 'no robust edge'}`);
  console.log('  per year: ' + yearStats.map(([y, s]) => `${y} ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(2)}R/${s.n}`).join('  '));
  // How the next-best dev picks fared — if only #1 works out of sample, it was luck
  console.log('  runners-up (dev t → val exp / hold exp): ' + ranked.slice(1, 5).map(r => `${r.dev.t.toFixed(1)}→${f3(r.val.exp)}/${f3(r.hold.exp)}`).join('  ') + '\n');

  report.push(`Best on 2016–2021: \`${JSON.stringify(best.p)}\` — **${edge ? 'EDGE HOLDS' : 'no robust edge'}** (${posYears}/${yearStats.length} years positive)`, '',
    '| period | trades | win rate | win (95% low) | expectancy | profit factor | t-stat | max DD |', '|---|---|---|---|---|---|---|---|',
    ...[['2016–21 (chosen here)', best.dev], ['2022–23 validation', best.val], ['**2024–26 holdout**', best.hold]].map(([k, s]) =>
      `| ${k} | ${s.n} | ${pct(s.winRate)} | ${pct(s.winLow)} | ${f3(s.exp)}R | ${f3(s.pf)} | ${s.t.toFixed(2)} | ${s.maxDD.toFixed(1)}R |`),
    '', 'Per year: ' + yearStats.map(([y, s]) => `${y}: ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(2)}R (n=${s.n}, win ${pct(s.winRate)})`).join(' · '), '');
  profile[S.id] = { params: best.p, edge, dev: best.dev, val: best.val, hold: best.hold, positiveYears: `${posYears}/${yearStats.length}` };
}

await mkdir('data', { recursive: true });
await writeFile('data/gold-report.md', report.join('\n'));
await writeFile('data/gold-profile.json', JSON.stringify({ generatedAt: Date.now(), split: SPLIT, playbooks: profile }, null, 1));
console.log('Report: data/gold-report.md');
