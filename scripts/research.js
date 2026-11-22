/**
 * Rebuilds the signal profiles from scratch. Run weekly, or after any
 * change to strategy code. The live scanner only ever signals what the
 * latest research run enabled.
 *
 * npm run research                       both playbooks, all instruments
 * npm run research -- swing              daily swing playbook only
 * npm run research -- intraday XAUUSD    hourly playbook, one instrument
 * npm run research -- --min-win 0.7      stricter win-rate floor (intraday)
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { runResearch } from '../src/signals/research.js';
import { INSTRUMENT_KEYS } from '../src/signals/instruments.js';
import { researchSwing, SWING_INSTRUMENTS } from '../src/signals/swing.js';

const DATA = new URL('../data/', import.meta.url);
const args = process.argv.slice(2);
const mw = args.indexOf('--min-win');
const minWinRate = mw >= 0 ? Number(args[mw + 1]) : 0.6;
const list = args.find(a => /^[A-Z,]+$/.test(a));
const only = args.find(a => a === 'swing' || a === 'intraday');
const pct = v => `${(v * 100).toFixed(1)}%`;
const fx = (v, d = 3) => Number.isFinite(v) ? v.toFixed(d) : '∞';

if (only !== 'intraday') {
  console.log('\n=== Swing playbook — daily dip in an uptrend ===');
  const keys = list ? list.split(',').filter(k => SWING_INSTRUMENTS[k]) : Object.keys(SWING_INSTRUMENTS);
  const results = [];
  for (const k of keys) results.push(await researchSwing(k));
  await mkdir(DATA, { recursive: true });
  await writeFile(new URL('swing-profile.json', DATA), JSON.stringify({ generatedAt: Date.now(), instruments: Object.fromEntries(results.map(r => [r.key, r])) }, null, 1));

  const L = ['# Swing playbook — research', '', `Generated ${new Date().toISOString()}. Daily bars, entry next open, exit on first close above the 5-day average, 10-day time stop, 3-ATR protective stop. Spread and overnight swap charged on every trade. Rules fixed in advance — no parameter search.`, ''];
  for (const r of results) {
    if (!r.all) { console.log(`${r.key.padEnd(7)} DISABLED  ${r.reason}`); continue; }
    const line = (label, s) => `${label.padEnd(12)} ${String(s.n).padStart(3)} trades  win ${pct(s.winRate)} (95% low ${pct(s.winRateLow95)})  ${fx(s.expectancyR)}R/trade  PF ${fx(s.profitFactor, 2)}  stops ${s.stopOuts}  maxDD ${fx(s.maxDrawdownR, 1)}R`;
    console.log(`\n${r.key} ${r.enabled ? 'ENABLED' : 'DISABLED'} — ${r.reason} — ~${r.signalsPerMonth} signals/month`);
    console.log('  ' + line('development', r.development));
    console.log('  ' + line('holdout', r.holdout));
    console.log('  by dip depth: ' + r.buckets.map(b => `RSI ${b.rsiFrom}-${b.rsiTo}: ${pct(b.winRate)} (low ${pct(b.winRateLow95)}, n=${b.n})`).join(' | '));
    for (const f of [r.flip, r.flipAggressive].filter(Boolean)) console.log(`  flip @${f.riskPct}% risk: doubles first ${pct(f.pDoubleFirst)}, halves first ${pct(f.pHalveFirst)}, median ${f.medianTradesToDouble ?? '-'} trades to double`);

    L.push(`## ${r.key} — ${r.enabled ? 'ENABLED' : 'DISABLED'}`, '', `${r.reason}. ~${r.signalsPerMonth} signals/month. Data ${new Date(r.bars.from).toISOString().slice(0, 10)} → ${new Date(r.bars.to).toISOString().slice(0, 10)}.`, '',
      '| sample | trades | win rate | win (95% low) | expectancy | profit factor | stop-outs | avg nights | max DD |', '|---|---|---|---|---|---|---|---|---|',
      ...[['development (first 70%)', r.development], ['**holdout (last 30%)**', r.holdout], ['all', r.all]].map(([k, s]) =>
        `| ${k} | ${s.n} | ${pct(s.winRate)} | ${pct(s.winRateLow95)} | ${fx(s.expectancyR)}R | ${fx(s.profitFactor, 2)} | ${s.stopOuts} | ${s.avgNights.toFixed(1)} | ${fx(s.maxDrawdownR, 1)}R |`),
      '', 'Win rate by dip depth (all history):', '', '| RSI(2) at signal | trades | win rate | win (95% low) |', '|---|---|---|---|',
      ...r.buckets.map(b => `| ${b.rsiFrom}–${b.rsiTo} | ${b.n} | ${pct(b.winRate)} | ${pct(b.winRateLow95)} |`), '',
      ...[r.flip, r.flipAggressive].filter(Boolean).map(f => `- Flip odds at ${f.riskPct}% risk: doubles before halving in **${pct(f.pDoubleFirst)}** of 4,000 simulations; halves first in ${pct(f.pHalveFirst)}; median ${f.medianTradesToDouble ?? '—'} trades to double.`), '');
  }
  await writeFile(new URL('swing-report.md', DATA), L.join('\n'));
  console.log('\nFull report: data/swing-report.md');
}

if (only !== 'swing') {
  console.log('\n=== Intraday playbook — hourly setups + probability model ===');
  const keys = list ? list.split(',').filter(k => INSTRUMENT_KEYS.includes(k)) : INSTRUMENT_KEYS;
  const results = await runResearch({ instruments: keys, minWinRate });
  for (const r of results) {
    if (!r.holdout) { console.log(`${r.key.padEnd(7)} DISABLED  ${r.reason}`); continue; }
    const h = r.holdout;
    console.log(`${r.key.padEnd(7)} ${r.enabled ? 'ENABLED ' : 'DISABLED'}  ${r.tpMult}R be=${r.beFrac ?? 'off'} p>=${r.threshold}  holdout: ${h.n} trades, win ${pct(h.winRate)} (95% low ${pct(h.winRateLow95)}), ${fx(h.expectancyR)}R/trade, PF ${fx(h.profitFactor, 2)}, ~${r.signalsPerMonth}/mo`);
  }
  console.log('Full report: data/research-report.md');
}
