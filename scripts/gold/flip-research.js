/**
 * npm run gold:flip [-- SR,BR]
 *
 * Research for the small-stop / big-RR "flip" playbooks on XAUUSD minute
 * data. Works on whatever history has been downloaded so far: available
 * gold days are split 60/20/20 in time (develop / validate / holdout),
 * parameters are chosen on the first 60% only, and everything is labelled
 * PRELIMINARY until at least 3 years of data are in.
 *
 * Reported for each playbook: hit rate, expectancy, profit factor, the
 * longest losing streak (the thing that breaks people at 25% win rates),
 * trades per week, and Monte Carlo odds of doubling the account before
 * halving it at 2% and 5% risk per trade.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { loadM1 } from '../../src/signals/gold/m1.js';
import { buildContext } from '../../src/signals/gold/context.js';
import { FLIP_STRATEGIES } from '../../src/signals/gold/flip.js';
import { combos } from '../../src/signals/gold/strategies.js';
import { wilsonLower } from '../../src/signals/model.js';
import { monteCarlo } from '../../src/signals/backtest.js';

const pct = v => `${(v * 100).toFixed(1)}%`;
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : '∞');

function stats(ts, weeks) {
  const n = ts.length;
  if (!n) return { n: 0, winRate: 0, winLow: 0, exp: 0, pf: 0, t: 0, maxDD: 0, streak: 0, perWeek: 0, avgWin: 0 };
  const wins = ts.filter(t => t.outcome === 'TP' || t.R > 0.5);
  const sumR = ts.reduce((s, t) => s + t.R, 0), mean = sumR / n;
  const sd = Math.sqrt(ts.reduce((s, t) => s + (t.R - mean) ** 2, 0) / Math.max(1, n - 1));
  const gross = ts.filter(t => t.R > 0).reduce((s, t) => s + t.R, 0);
  const loss = -ts.filter(t => t.R < 0).reduce((s, t) => s + t.R, 0);
  let eq = 0, peak = 0, dd = 0, run = 0, streak = 0;
  for (const t of ts) {
    eq += t.R; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq);
    run = t.R < 0 ? run + 1 : 0; streak = Math.max(streak, run);
  }
  return {
    n, winRate: wins.length / n, winLow: wilsonLower(wins.length, n), exp: mean,
    pf: loss ? gross / loss : Infinity, t: sd ? mean / sd * Math.sqrt(n) : 0, maxDD: dd, streak,
    perWeek: weeks ? n / weeks : 0, avgWin: wins.length ? wins.reduce((s, t) => s + t.R, 0) / wins.length : 0
  };
}

const only = process.argv[2]?.split(',');
const m = await loadM1();
const ctx = buildContext(m);
const days = ctx.d;
const spanYears = (m.t[m.n - 1] - m.t[0]) / (365.25 * 86400);
const cut1 = days.t[Math.floor(days.n * 0.6)], cut2 = days.t[Math.floor(days.n * 0.8)];
const part = (ts, a, b) => ts.filter(t => t.entryT >= a && t.entryT < b);
const weeksIn = (a, b) => (b - a) / (7 * 86400);
const fmtD = s => new Date(s * 1000).toISOString().slice(0, 10);
const preliminary = spanYears < 3;

console.log(`${m.n.toLocaleString()} minutes, ${days.n} gold days, ${fmtD(m.t[0])} → ${fmtD(m.t[m.n - 1])} (${spanYears.toFixed(1)} years)${preliminary ? '  — PRELIMINARY: under 3 years of data' : ''}`);
console.log(`develop < ${fmtD(cut1)} ≤ validate < ${fmtD(cut2)} ≤ holdout\n`);

const L = ['# XAUUSD flip playbooks — small stop, big RR', '',
  `${fmtD(m.t[0])} → ${fmtD(m.t[m.n - 1])} (${spanYears.toFixed(1)} years of minute bid/ask). ${preliminary ? '**PRELIMINARY — less than 3 years of data; treat as a direction, not a verdict.**' : ''}`,
  `Stops ≤ 20 pips ($2.00, 1 pip = $0.10). Real bid/ask fills, stop-first on ambiguous minutes, $0.05 stop slippage. Parameters chosen on the first 60% of days only.`, ''];
const T0 = m.t[0], T1 = m.t[m.n - 1] + 60;

for (const S of FLIP_STRATEGIES.filter(s => !only || only.includes(s.id))) {
  const rows = combos(S.grid).map(p => {
    const ts = S.run(ctx, p);
    return { p, ts, dev: stats(part(ts, T0, cut1), weeksIn(T0, cut1)), val: stats(part(ts, cut1, cut2), weeksIn(cut1, cut2)), hold: stats(part(ts, cut2, T1), weeksIn(cut2, T1)) };
  });
  const minDev = Math.max(30, Math.round(days.n * 0.6 / 20)); // ≥ ~1 trade a month
  const ranked = rows.filter(r => r.dev.n >= minDev).sort((a, b) => b.dev.t - a.dev.t);
  console.log(`== ${S.id} ${S.name} (${rows.length} combos)`);
  L.push(`## ${S.id} — ${S.name}`, '');
  if (!ranked.length) { console.log('  too few trades\n'); L.push('Too few trades.', ''); continue; }
  const best = ranked[0];
  const all = stats(best.ts, weeksIn(T0, T1));
  const edge = best.dev.exp > 0 && best.val.exp > 0 && best.hold.exp > 0;
  const line = (lab, s) => `${lab.padEnd(5)} n=${String(s.n).padStart(4)} win ${pct(s.winRate).padStart(6)} avgWin ${f2(s.avgWin)}R exp ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)}R PF ${f2(s.pf)} t=${s.t.toFixed(2)} DD ${s.maxDD.toFixed(1)}R lose-streak ${s.streak} ${s.perWeek.toFixed(1)}/wk`;
  console.log(`  best on develop: ${JSON.stringify(best.p)}  →  ${edge ? 'POSITIVE in all three periods' : 'does NOT hold out of sample'}`);
  console.log('  ' + line('dev', best.dev)); console.log('  ' + line('val', best.val)); console.log('  ' + line('hold', best.hold));
  const mc2 = monteCarlo(best.ts.map(t => t.R), { riskPct: 2 }), mc5 = monteCarlo(best.ts.map(t => t.R), { riskPct: 5 });
  if (mc2) console.log(`  flip odds (all trades): @2% doubles first ${pct(mc2.pDoubleFirst)} / halves first ${pct(mc2.pHalveFirst)}; @5% ${pct(mc5.pDoubleFirst)} / ${pct(mc5.pHalveFirst)}, median ${mc5.medianTradesToDouble ?? '-'} trades`);
  console.log('  runners-up dev t → val/hold exp: ' + ranked.slice(1, 6).map(r => `${r.dev.t.toFixed(1)}→${r.val.exp.toFixed(2)}/${r.hold.exp.toFixed(2)}`).join('  ') + '\n');

  L.push(`Best on develop: \`${JSON.stringify(best.p)}\` — **${edge ? 'positive in develop, validate AND holdout' : 'does not hold out of sample'}**`, '',
    '| period | trades | win rate | avg win | expectancy | profit factor | max DD | longest losing streak | trades/week |', '|---|---|---|---|---|---|---|---|---|',
    ...[['develop (chosen here)', best.dev], ['validate', best.val], ['**holdout**', best.hold], ['all', all]].map(([k, s]) =>
      `| ${k} | ${s.n} | ${pct(s.winRate)} | ${f2(s.avgWin)}R | ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)}R | ${f2(s.pf)} | ${s.maxDD.toFixed(1)}R | ${s.streak} | ${s.perWeek.toFixed(1)} |`), '');
  if (mc2) L.push(`Flip odds over all trades: at 2% risk the account doubles before halving in ${pct(mc2.pDoubleFirst)} of simulations (halves first ${pct(mc2.pHalveFirst)}); at 5% risk ${pct(mc5.pDoubleFirst)} vs ${pct(mc5.pHalveFirst)}, median ${mc5.medianTradesToDouble ?? '—'} trades to double.`, '');
}

await mkdir('data', { recursive: true });
await writeFile('data/gold-flip-report.md', L.join('\n'));
console.log('Report: data/gold-flip-report.md');
