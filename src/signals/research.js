import { mkdir, writeFile } from 'node:fs/promises';
import { log } from '../lib/logger.js';
import { INSTRUMENTS, INSTRUMENT_KEYS } from './instruments.js';
import { loadHistory } from './data.js';
import { computeIndicators, WARMUP } from './indicators.js';
import { STRATEGIES } from './strategies.js';
import { FEATURES } from './features.js';
import { train, predict } from './model.js';
import { generateCandidates, takeSequential, stats, monteCarlo, MAX_BARS } from './backtest.js';

/**
 * Research pipeline: decides, per instrument, whether there is an edge
 * worth signalling and at what settings — and proves it on data that
 * played no part in the decision.
 *
 *   |-------- train 50% --------|-- validation 25% --|-- holdout 25% --|
 *
 * The model is retrained walk-forward (expanding window, six folds) so
 * every validation and holdout prediction comes from a model that never
 * saw that trade or anything after it. The reward multiple and the
 * probability threshold are chosen on validation only. Holdout is
 * touched exactly once, to report the number we can honestly quote.
 * An instrument whose holdout does not hold up is switched off.
 */
const DATA = new URL('../../data/', import.meta.url);
const TP_MULTS = [0.6, 0.8, 1.0, 1.5, 2.0];
// Breakeven: move the stop to entry once price has covered this fraction of the way to target (null = never)
const BE_FRACS = [null, 0.6];
const THRESHOLDS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
const FOLDS = 6;
const MIN_VAL_TRADES = 15;
const MIN_HOLDOUT_TRADES = 8; // CLAUDE.md: below 8 instances a result is not presented as reliable
const MIN_EXPECTANCY = 0.08;  // R per trade after costs — below this, spread variance eats the edge

const pct = v => `${(v * 100).toFixed(1)}%`;
const r2 = v => Math.round(v * 1000) / 1000;

function walkForward(cands, bars) {
  const span = bars.length - WARMUP;
  const trainEnd = WARMUP + Math.floor(span * 0.5);
  const valEnd = WARMUP + Math.floor(span * 0.75);
  const foldLen = Math.ceil((bars.length - trainEnd) / FOLDS);
  const oos = [];
  for (let f = 0; f < FOLDS; f++) {
    const s = trainEnd + f * foldLen, e = Math.min(s + foldLen, bars.length);
    // A training trade must have CLOSED before the fold starts — otherwise its label leaks the future
    const tr = cands.filter(c => c.exitIdx < s);
    const te = cands.filter(c => c.i >= s && c.i < e);
    if (tr.length < 60 || !te.length) continue;
    const m = train(tr.map(c => c.x), tr.map(c => c.win));
    for (const c of te) oos.push({ ...c, p: predict(m, c.x) });
  }
  return {
    validation: oos.filter(c => c.i < valEnd),
    holdout: oos.filter(c => c.i >= valEnd),
    split: { trainEnd: bars[trainEnd].t, valEnd: bars[valEnd].t }
  };
}

async function researchInstrument(key, minWinRate) {
  const inst = INSTRUMENTS[key];
  const bars = await loadHistory(key);
  if (!bars || bars.length < WARMUP + 2000) {
    log.warn(`${key}: not enough history (${bars?.length ?? 0} bars) — skipped`);
    return { key, enabled: false, reason: 'insufficient history' };
  }
  const x = computeIndicators(bars);
  log.info(`${key}: ${bars.length} hourly bars, ${new Date(bars[0].t).toISOString().slice(0, 10)} → ${new Date(bars.at(-1).t).toISOString().slice(0, 10)}`);

  const grid = [];
  const baselines = {};
  for (const tpMult of TP_MULTS) for (const beFrac of BE_FRACS) {
    const cands = generateCandidates(bars, x, key, tpMult, beFrac);
    const wf = walkForward(cands, bars);
    baselines[`${tpMult}|${beFrac}`] = Object.fromEntries(STRATEGIES.map(s => {
      const st = stats(takeSequential(wf.validation.filter(c => c.strategy === s.id).map(c => ({ ...c, p: 0 }))));
      return [s.id, { n: st.n, winRate: r2(st.winRate), expectancyR: r2(st.expectancyR) }];
    }));
    for (const thr of THRESHOLDS) {
      const v = stats(takeSequential(wf.validation.filter(c => c.p >= thr)));
      grid.push({ tpMult, beFrac, thr, v, cands, wf });
    }
  }

  // Highest win rate we can defend (Wilson lower bound) among settings that also make money
  const eligible = grid.filter(g => g.v.n >= MIN_VAL_TRADES && g.v.expectancyR >= MIN_EXPECTANCY
    && g.v.profitFactor > 1.2 && g.v.winRate >= minWinRate);
  eligible.sort((a, b) => b.v.winRateLow95 - a.v.winRateLow95 || b.v.expectancyR - a.v.expectancyR);
  const best = eligible[0];

  if (!best) {
    const top = [...grid].filter(g => g.v.n >= MIN_VAL_TRADES).sort((a, b) => b.v.expectancyR - a.v.expectancyR)[0];
    log.warn(`${key}: no setting passed validation — disabled`);
    return {
      key, enabled: false, reason: 'no setting met validation criteria',
      bestSeen: top ? { tpMult: top.tpMult, beFrac: top.beFrac, threshold: top.thr, validation: top.v } : null,
      baselines: baselines[`1|null`]
    };
  }

  const holdTrades = takeSequential(best.wf.holdout.filter(c => c.p >= best.thr));
  const h = stats(holdTrades);
  const holdsUp = h.n >= MIN_HOLDOUT_TRADES && h.expectancyR > 0;

  // Live model: same recipe, trained on every resolved trade we have
  const final = train(best.cands.map(c => c.x), best.cands.map(c => c.win));
  const yearsHold = (bars.at(-1).t - best.wf.split.valEnd) / (365 * 24 * 3600_000);

  return {
    key, enabled: holdsUp,
    reason: holdsUp ? 'passed validation and holdout' : `holdout failed (n=${h.n}, expectancy ${r2(h.expectancyR)}R)`,
    tpMult: best.tpMult, beFrac: best.beFrac, threshold: best.thr, maxBars: MAX_BARS,
    validation: best.v, holdout: h,
    signalsPerMonth: r2(h.n / Math.max(yearsHold * 12, 1e-9)),
    flip: monteCarlo(holdTrades.map(t => t.R), { riskPct: 2 }),
    flipAggressive: monteCarlo(holdTrades.map(t => t.R), { riskPct: 5 }),
    split: best.wf.split,
    model: { features: FEATURES, ...final },
    baselines: baselines[`${best.tpMult}|${best.beFrac}`],
    bars: { from: bars[0].t, to: bars.at(-1).t, count: bars.length }
  };
}

function report(results, minWinRate) {
  const L = [`# Fiper Signal Engine — research report`, ``, `Generated ${new Date().toISOString()}. Hourly bars, entries at next-bar open, costs included, stop assumed first when a bar spans both levels.`, ``,
    `Selection rule: highest defensible win rate (Wilson 95% lower bound) on **validation**, subject to win rate ≥ ${pct(minWinRate)}, expectancy ≥ ${MIN_EXPECTANCY}R and profit factor > 1.2. **Holdout** numbers below were never used to choose anything — quote those.`, ``];
  for (const r of results) {
    L.push(`## ${r.key} — ${r.enabled ? 'ENABLED' : 'DISABLED'}`, ``, `${r.reason}.`, ``);
    if (r.validation) {
      L.push(`Target ${r.tpMult}R · breakeven ${r.beFrac ? `at ${r.beFrac * 100}% of the way` : "off"} · threshold p ≥ ${r.threshold} · ~${r.signalsPerMonth} signals/month`, ``,
        `| | trades | win rate | win rate (95% low) | full-loss rate | expectancy | profit factor | max DD |`, `|---|---|---|---|---|---|---|---|`,
        ...[['validation', r.validation], ['**holdout**', r.holdout]].map(([k, s]) =>
          `| ${k} | ${s.n} | ${pct(s.winRate)} | ${pct(s.winRateLow95)} | ${pct(s.fullLossRate)} | ${s.expectancyR.toFixed(3)}R | ${Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'} | ${s.maxDrawdownR.toFixed(1)}R |`), ``);
      for (const f of [r.flip, r.flipAggressive].filter(Boolean)) {
        L.push(`- Flip odds at ${f.riskPct}% risk/trade: doubles before halving in **${pct(f.pDoubleFirst)}** of simulations, halves first in ${pct(f.pHalveFirst)}; median ${f.medianTradesToDouble ?? '—'} trades to double.`);
      }
      L.push(``);
    } else if (r.bestSeen) {
      const v = r.bestSeen.validation;
      L.push(`Best seen on validation: ${r.bestSeen.tpMult}R, p ≥ ${r.bestSeen.threshold} → ${v.n} trades, ${pct(v.winRate)} win, ${v.expectancyR.toFixed(3)}R expectancy.`, ``);
    }
    if (r.baselines) {
      L.push(`Raw strategies on validation (no model filter) — what the model starts from:`, ``, `| strategy | trades | win rate | expectancy |`, `|---|---|---|---|`,
        ...Object.entries(r.baselines).map(([k, b]) => `| ${k} | ${b.n} | ${pct(b.winRate)} | ${b.expectancyR}R |`), ``);
    }
  }
  return L.join('\n');
}

export async function runResearch({ instruments = INSTRUMENT_KEYS, minWinRate = 0.6 } = {}) {
  const results = [];
  for (const key of instruments) results.push(await researchInstrument(key, minWinRate));
  await mkdir(DATA, { recursive: true });
  const profile = { generatedAt: Date.now(), minWinRate, instruments: Object.fromEntries(results.map(r => [r.key, r])) };
  await writeFile(new URL('signal-profile.json', DATA), JSON.stringify(profile, null, 1));
  await writeFile(new URL('research-report.md', DATA), report(results, minWinRate));
  return results;
}
