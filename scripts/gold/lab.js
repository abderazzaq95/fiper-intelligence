/**
 * npm run gold:lab -- --set hp|flip|core|all [--objective win|t] [AF,SR,...]
 *
 * The XAUUSD strategy lab. Works on whatever minute history has been
 * downloaded so far: the most recent unbroken run of months is split
 * 60/20/20 in time (develop / validate / holdout), settings are chosen on
 * the develop slice only, and everything is labelled PRELIMINARY until at
 * least 3 years of data are in.
 *
 * Objectives:
 *   win — highest DEFENSIBLE win rate (Wilson 95% lower bound) among
 *         settings that also made money on develop  (default for "hp")
 *   t   — most reliable profit (t-statistic of R)    (default otherwise)
 *
 * Also reported: longest losing streak, trades per week, and Monte Carlo
 * odds of doubling the account before halving it at 2% and 5% risk.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadM1 } from '../../src/signals/gold/m1.js';
import { buildContext } from '../../src/signals/gold/context.js';
import { FLIP_STRATEGIES } from '../../src/signals/gold/flip.js';
import { HP_STRATEGIES } from '../../src/signals/gold/hp.js';
import { combos, GOLD_STRATEGIES } from '../../src/signals/gold/strategies.js';
import { wilsonLower } from '../../src/signals/model.js';
import { monteCarlo } from '../../src/signals/backtest.js';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const SET = opt('--set') || 'all';
const OBJECTIVE = opt('--objective') || (SET === 'hp' ? 'win' : 't');
const only = args.find(a => /^[A-Z,]+$/.test(a))?.split(',');
const POOL = { flip: FLIP_STRATEGIES, hp: HP_STRATEGIES, core: GOLD_STRATEGIES, all: [...HP_STRATEGIES, ...FLIP_STRATEGIES, ...GOLD_STRATEGIES] }[SET];
if (!POOL) throw new Error(`unknown --set ${SET} (hp | flip | core | all)`);

const pct = v => `${(v * 100).toFixed(1)}%`;
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : '∞');

function stats(ts, weeks) {
  const n = ts.length;
  if (!n) return { n: 0, winRate: 0, winLow: 0, exp: 0, pf: 0, t: 0, maxDD: 0, streak: 0, perWeek: 0, avgWin: 0, avgLoss: 0 };
  const wins = ts.filter(t => t.R > 0), losses = ts.filter(t => t.R <= 0);
  const sumR = ts.reduce((s, t) => s + t.R, 0), mean = sumR / n;
  const sd = Math.sqrt(ts.reduce((s, t) => s + (t.R - mean) ** 2, 0) / Math.max(1, n - 1));
  const gross = wins.reduce((s, t) => s + t.R, 0);
  const loss = -losses.reduce((s, t) => s + t.R, 0);
  let eq = 0, peak = 0, dd = 0, run = 0, streak = 0;
  for (const t of ts) {
    eq += t.R; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq);
    run = t.R <= 0 ? run + 1 : 0; streak = Math.max(streak, run);
  }
  return {
    n, winRate: wins.length / n, winLow: wilsonLower(wins.length, n), exp: mean,
    pf: loss ? gross / loss : Infinity, t: sd ? mean / sd * Math.sqrt(n) : 0, maxDD: dd, streak,
    perWeek: weeks ? n / weeks : 0,
    avgWin: wins.length ? gross / wins.length : 0, avgLoss: losses.length ? -loss / losses.length : 0
  };
}

// Exness's own tick history is the ground truth (it is the broker we trade on); Dukascopy is the fallback
const EXNESS = new URL('../../data/gold/exness-m1/', import.meta.url);
const SOURCE = opt('--source') || (existsSync(EXNESS) ? 'exness' : 'dukascopy');
const m = await loadM1(SOURCE === 'exness' ? EXNESS : undefined);
console.log(`source: ${SOURCE}`);
const ctx = buildContext(m);
const days = ctx.d;
const spanYears = (m.t[m.n - 1] - m.t[0]) / (365.25 * 86400);
const cut1 = days.t[Math.floor(days.n * 0.6)], cut2 = days.t[Math.floor(days.n * 0.8)];
const T0 = m.t[0], T1 = m.t[m.n - 1] + 60;
const part = (ts, a, b) => ts.filter(t => t.entryT >= a && t.entryT < b);
const weeksIn = (a, b) => (b - a) / (7 * 86400);
const fmtD = s => new Date(s * 1000).toISOString().slice(0, 10);
const preliminary = spanYears < 3;

console.log(`${m.n.toLocaleString()} minutes, ${days.n} gold days, ${fmtD(T0)} → ${fmtD(m.t[m.n - 1])} (${spanYears.toFixed(1)} years)${preliminary ? '  — PRELIMINARY: under 3 years of data' : ''}`);
console.log(`set "${SET}", objective "${OBJECTIVE}"; develop < ${fmtD(cut1)} ≤ validate < ${fmtD(cut2)} ≤ holdout\n`);

const L = [`# XAUUSD strategy lab — set "${SET}", objective "${OBJECTIVE}"`, '',
  `${fmtD(T0)} → ${fmtD(m.t[m.n - 1])} (${spanYears.toFixed(1)} years of minute bid/ask). ${preliminary ? '**PRELIMINARY — less than 3 years of data; a direction, not a verdict.**' : ''}`,
  'Real bid/ask fills, stop-first on ambiguous minutes, $0.05 stop slippage. Settings chosen on the first 60% of days only; validate and holdout never influence the choice.', ''];

for (const S of POOL.filter(s => !only || only.includes(s.id))) {
  const rows = combos(S.grid).map(p => {
    const ts = S.run(ctx, p);
    return { p, ts, dev: stats(part(ts, T0, cut1), weeksIn(T0, cut1)), val: stats(part(ts, cut1, cut2), weeksIn(cut1, cut2)), hold: stats(part(ts, cut2, T1), weeksIn(cut2, T1)) };
  });
  const minDev = Math.max(30, Math.round(days.n * 0.6 / 20)); // at least ~1 trade a month
  const ranked = rows
    .filter(r => r.dev.n >= minDev && (OBJECTIVE !== 'win' || (r.dev.exp > 0.03 && r.dev.pf > 1.1)))
    .sort((a, b) => OBJECTIVE === 'win' ? b.dev.winLow - a.dev.winLow : b.dev.t - a.dev.t);

  console.log(`== ${S.id} ${S.name} (${rows.length} settings)`);
  L.push(`## ${S.id} — ${S.name}`, '');
  if (!ranked.length) {
    const most = Math.max(...rows.map(r => r.dev.n));
    const why = most < minDev ? `too few trades (best setting had ${most}, need ${minDev})` : 'no setting was profitable on the develop period';
    console.log(`  ${why}\n`); L.push(`${why}.`, ''); continue;
  }
  const best = ranked[0];
  const all = stats(best.ts, weeksIn(T0, T1));
  const edge = best.dev.exp > 0 && best.val.exp > 0 && best.hold.exp > 0;
  const line = (lab, s) => `${lab.padEnd(5)} n=${String(s.n).padStart(4)} win ${pct(s.winRate).padStart(6)} (low ${pct(s.winLow)}) win/loss ${f2(s.avgWin)}/${f2(s.avgLoss)}R exp ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)}R PF ${f2(s.pf)} DD ${s.maxDD.toFixed(1)}R streak ${s.streak} ${s.perWeek.toFixed(1)}/wk`;
  console.log(`  chosen on develop: ${JSON.stringify(best.p)}  →  ${edge ? 'POSITIVE in all three periods' : 'does NOT hold out of sample'}`);
  console.log('  ' + line('dev', best.dev)); console.log('  ' + line('val', best.val)); console.log('  ' + line('hold', best.hold));
  const mc2 = monteCarlo(best.ts.map(t => t.R), { riskPct: 2 }), mc5 = monteCarlo(best.ts.map(t => t.R), { riskPct: 5 });
  if (mc2) console.log(`  flip odds: @2% doubles first ${pct(mc2.pDoubleFirst)} / halves first ${pct(mc2.pHalveFirst)}; @5% ${pct(mc5.pDoubleFirst)} / ${pct(mc5.pHalveFirst)}, median ${mc5.medianTradesToDouble ?? '-'} trades`);
  // If only the #1 setting works out of sample, it was luck; robust edges have good neighbours
  console.log('  next best on develop → validate/holdout expectancy: ' + ranked.slice(1, 6).map(r => `${r.val.exp.toFixed(2)}/${r.hold.exp.toFixed(2)}`).join('  ') + '\n');

  L.push(`Chosen on develop: \`${JSON.stringify(best.p)}\` — **${edge ? 'positive in develop, validate AND holdout' : 'does not hold out of sample'}**`, '',
    '| period | trades | win rate | win (95% low) | avg win / loss | expectancy | profit factor | max DD | longest losing streak | trades/week |', '|---|---|---|---|---|---|---|---|---|---|',
    ...[['develop (chosen here)', best.dev], ['validate', best.val], ['**holdout**', best.hold], ['all', all]].map(([k, s]) =>
      `| ${k} | ${s.n} | ${pct(s.winRate)} | ${pct(s.winLow)} | ${f2(s.avgWin)} / ${f2(s.avgLoss)}R | ${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)}R | ${f2(s.pf)} | ${s.maxDD.toFixed(1)}R | ${s.streak} | ${s.perWeek.toFixed(1)} |`), '');
  if (mc2) L.push(`Flip odds over all trades: at 2% risk the account doubles before halving in ${pct(mc2.pDoubleFirst)} of simulations (halves first ${pct(mc2.pHalveFirst)}); at 5% risk ${pct(mc5.pDoubleFirst)} vs ${pct(mc5.pHalveFirst)}, median ${mc5.medianTradesToDouble ?? '—'} trades to double.`, '');
}

await mkdir('data', { recursive: true });
await writeFile(`data/gold-lab-${SET}.md`, L.join('\n'));
console.log(`Report: data/gold-lab-${SET}.md`);
