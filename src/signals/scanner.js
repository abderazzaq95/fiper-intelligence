import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { log } from '../lib/logger.js';
import { sendTelegram, esc } from './telegram.js';
import { loadDaily, completedDaily, swingIndicators, swingSignalAt, nextExitLevel, bucketOf, RULES, SWING_INSTRUMENTS } from './swing.js';
import { INSTRUMENTS, costFor } from './instruments.js';
import { loadRecent } from './data.js';
import { computeIndicators } from './indicators.js';
import { STRATEGIES, strategyById } from './strategies.js';
import { featureVector, describe } from './features.js';
import { predict, explain } from './model.js';
import { buildTrade, simulate } from './backtest.js';

/**
 * The live loop: on every newly closed bar, ask each ENABLED playbook
 * whether there is a signal, alert it, then follow it to its exit and
 * alert that too. Only what the latest research run enabled can fire —
 * if research switches an instrument off, the scanner goes quiet on it.
 *
 * Every signal's outcome is recorded, so the live hit rate sits next to
 * the backtest one. If the two drift apart, believe the live one.
 */
const DATA = new URL('../../data/', import.meta.url);
const STATE = new URL('signals-state.json', DATA);
const fmt = (v, d = 2) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = v => `${(v * 100).toFixed(1)}%`;

const account = () => ({
  balance: Number(process.env.SIGNAL_ACCOUNT_BALANCE || 100),
  type: (process.env.SIGNAL_ACCOUNT_TYPE || 'cent').toLowerCase(), // cent | standard
  riskPct: Number(process.env.SIGNAL_RISK_PCT || 2)
});

async function readJson(url, fallback) {
  try { return JSON.parse(await readFile(url, 'utf8')); } catch { return fallback; }
}
export const loadState = () => readJson(STATE, { lastBar: {}, open: [], closed: [] });
async function saveState(s) { await mkdir(DATA, { recursive: true }); await writeFile(STATE, JSON.stringify(s, null, 1)); }

/**
 * Lot size for the configured account. On a cent account the balance and
 * P/L are in US cents, so the same formula gives 100× more lots for the
 * same dollars — which is what makes 2% risk possible on $100 at all.
 */
function sizing(stopDist, contract) {
  const a = account();
  const units = a.type === 'cent' ? a.balance * 100 : a.balance;
  const riskUnits = units * a.riskPct / 100;
  const raw = riskUnits / (stopDist * contract);
  const lots = Math.floor(raw * 100) / 100;
  const minRiskPct = (0.01 * stopDist * contract) / units * 100;
  const label = a.type === 'cent' ? `$${a.balance} cent account` : `$${a.balance} account`;
  if (lots < 0.01) return `📏 Size: even the 0.01 minimum lot risks ${minRiskPct.toFixed(1)}% of a ${label} — <b>skip or accept the higher risk knowingly</b>.`;
  const riskUsd = lots * stopDist * contract / (a.type === 'cent' ? 100 : 1);
  return `📏 Size for ${label} at ${a.riskPct}% risk: <b>${fmt(lots)} lots</b> (risk ≈ $${fmt(riskUsd)}). Verify the contract size in MT5 → Specification.`;
}

const recordLine = (state, key) => {
  const mine = state.closed.filter(c => c.key === key);
  if (!mine.length) return 'Live record: first signal on this instrument.';
  const w = mine.filter(c => c.R > 0).length;
  return `Live record ${key}: ${w}/${mine.length} wins (${pct(w / mine.length)}), ${fmt(mine.reduce((s, c) => s + c.R, 0))}R total.`;
};

/* ---------------- swing playbook ---------------- */

/** `barsOverride` exists for replay tests — production always loads fresh bars. */
export async function scanSwing(key, prof, state, out, barsOverride = null) {
  const inst = SWING_INSTRUMENTS[key];
  const raw = barsOverride ?? await loadDaily(key, { maxAgeMs: 20 * 60_000 });
  if (!raw) return;
  const bars = barsOverride ?? completedDaily(raw);
  const i = bars.length - 1, b = bars[i];
  const slot = `swing:${key}`;
  if (state.lastBar[slot] === b.t) return; // this bar was already handled
  state.lastBar[slot] = b.t;
  const x = swingIndicators(bars);
  const open = state.open.find(o => o.slot === slot);

  if (open) {
    // Replay every bar since entry — if the scanner was offline for days, a stop hit in the gap still counts
    let exit = null, how = null, held = 0;
    for (let k = bars.findIndex(z => z.t > open.signalT); k >= 0 && k <= i; k++) {
      held++;
      if (bars[k].l <= open.stop) { exit = Math.min(bars[k].o, open.stop); how = 'STOP'; break; }
      if (x.c[k] > x.exit[k]) { exit = bars[k].c; how = 'TARGET'; break; }
      if (held >= RULES.maxDays) { exit = bars[k].c; how = 'TIME'; break; }
    }
    if (!exit) {
      out.push(`⏳ <b>${key}</b> dip-buy still open (day ${held}/${RULES.maxDays}). Close now ${fmt(b.c)} — exit on a daily close above <b>${fmt(nextExitLevel(x.c))}</b>. Stop stays ${fmt(open.stop)}.`);
      return;
    }
    // Same cost model as the backtest: spread once, swap per night held
    const R = ((exit - open.entry) / open.entry - inst.costPct - inst.swapPerDay * Math.max(1, held - 1)) / ((open.entry - open.stop) / open.entry);
    state.open = state.open.filter(o => o !== open);
    state.closed.push({ ...open, exit, how, R, closedT: b.t });
    const icon = R > 0 ? '✅' : '❌';
    out.push(`${icon} <b>CLOSE ${key}</b> — ${how === 'TARGET' ? 'exit rule: daily close above the 5-day average' : how === 'STOP' ? 'protective stop hit' : '10-day time stop'}\nEntry ${fmt(open.entry)} → exit ${fmt(exit)} · <b>${R >= 0 ? '+' : ''}${fmt(R)}R</b>\n${recordLine(state, key)}`);
    return;
  }

  const sig = swingSignalAt(bars, x, i);
  if (!sig) return;
  const stop = b.c - RULES.stopAtr * sig.atr;
  const bucket = prof.buckets[bucketOf(sig.rsi)];
  const s = { slot, key, playbook: 'swing', signalT: b.t, entry: b.c, stop, dir: 1 };
  state.open.push(s);
  out.push([
    `🟢 <b>BUY ${key}</b> · Daily Dip-in-Uptrend (${esc(inst.name)})`,
    `Entry: market, near ${fmt(b.c)} (signal on today's close; backtest enters next open)`,
    `🛑 Stop: <b>${fmt(stop)}</b>  (−${fmt(b.c - stop)} · ${RULES.stopAtr}×ATR) — place it as a distance from your fill`,
    `🎯 Exit: first daily close above <b>${fmt(nextExitLevel(x.c))}</b> (5-day avg) — or after ${RULES.maxDays} days. I will message you.`,
    `📊 Win rate on unseen data: <b>${pct(prof.holdout.winRate)}</b> (n=${prof.holdout.n}) · all history ${pct(prof.all.winRate)} (n=${prof.all.n}, 95% floor ${pct(prof.all.winRateLow95)})`,
    `   This dip depth (RSI2 ${fmt(sig.rsi, 1)}): ${pct(bucket.winRate)} (n=${bucket.n}) · avg hold ${prof.all.avgNights.toFixed(1)} nights`,
    `Why: ${fmt(sig.trendGapPct, 1)}% above the 200-day average (uptrend), ${sig.downDays} down day${sig.downDays === 1 ? '' : 's'} in a row, RSI(2) ${fmt(sig.rsi, 1)} = sharp oversold dip.`,
    sizing(b.c - stop, inst.contract),
    `⚠️ Feed: ${esc(inst.symbol)} — Exness prices differ slightly; swaps apply overnight. Not financial advice.`,
    recordLine(state, key)
  ].join('\n'));
}

/* ---------------- intraday playbook ---------------- */

async function scanIntraday(key, prof, state, out) {
  const inst = INSTRUMENTS[key];
  const bars = await loadRecent(key);
  if (!bars || bars.length < 700) return;
  const i = bars.length - 1, b = bars[i];
  const slot = `intraday:${key}`;
  const x = computeIndicators(bars);
  const open = state.open.find(o => o.slot === slot);

  if (open) {
    const start = bars.findIndex(k => k.t > open.signalT);
    if (start < 0) return;
    const res = simulate(bars, start, open, costFor(inst, open.entry), prof.maxBars);
    if (!res) return; // still running
    state.open = state.open.filter(o => o !== open);
    state.closed.push({ ...open, exit: res.exit, how: res.outcome, R: res.R, closedT: bars[res.exitIdx].t });
    const icon = res.R > 0.05 ? '✅' : res.R > -0.1 ? '➖' : '❌';
    const why = { TP: 'target hit', SL: 'stop hit', BE: 'stopped at breakeven', TIME: '24h time exit' }[res.outcome];
    out.push(`${icon} <b>CLOSE ${key}</b> — ${why}\nEntry ${fmt(open.entry)} → ${fmt(res.exit)} · <b>${res.R >= 0 ? '+' : ''}${fmt(res.R)}R</b>\n${recordLine(state, key)}`);
    return;
  }
  if (state.lastBar[slot] === b.t) return;
  state.lastBar[slot] = b.t;

  let best = null;
  for (const s of STRATEGIES) {
    const raw = s.detect(bars, x, i, key);
    if (!raw) continue;
    const setup = { ...raw, strategy: s.id };
    const trade = buildTrade(setup, b.c, x.atr[i], prof.tpMult, prof.beFrac);
    if (!trade) continue;
    const fv = featureVector(bars, x, i, setup, b.c);
    const p = predict(prof.model, fv);
    if (p >= prof.threshold && (!best || p > best.p)) best = { trade, fv, p, s };
  }
  if (!best) return;
  const { trade, fv, p, s } = best;
  const reasons = explain(prof.model, fv, prof.model.features).map(e => describe(e.name, e.c)).filter(Boolean).slice(0, 3);
  state.open.push({ slot, key, playbook: 'intraday', signalT: b.t, ...trade, strategy: s.id });
  const side = trade.dir > 0 ? '🟢 <b>BUY' : '🔴 <b>SELL';
  out.push([
    `${side} ${key}</b> · ${esc(strategyById(s.id).name)} (H1)`,
    `Entry: market, near ${fmt(trade.entry)}`,
    `🛑 Stop ${fmt(trade.stop)} (${trade.dir > 0 ? '−' : '+'}${fmt(trade.risk)})  🎯 Target ${fmt(trade.tp)} (${trade.dir > 0 ? '+' : '−'}${fmt(trade.tp * trade.dir - trade.entry * trade.dir)}) · ${prof.tpMult}R`,
    prof.beFrac ? `Move stop to breakeven once price is ${fmt(prof.beFrac * prof.tpMult * trade.risk)} in profit.` : null,
    `📊 Model probability ${pct(p)} · holdout win rate at this filter ${pct(prof.holdout.winRate)} (n=${prof.holdout.n})`,
    `Why: ${reasons.join(', ')}`,
    sizing(trade.risk, inst.contract),
    `⏱ Valid for this hour only; closes after 24h if neither level hits. Not financial advice.`
  ].filter(Boolean).join('\n'));
}

/* ---------------- loop ---------------- */

export async function scanOnce() {
  const [swing, intraday] = await Promise.all([
    readJson(new URL('swing-profile.json', DATA), null),
    readJson(new URL('signal-profile.json', DATA), null)
  ]);
  if (!swing && !intraday) { log.warn('signals: no research profile — run `npm run research` first'); return []; }
  const state = await loadState();
  const out = [];
  for (const [key, prof] of Object.entries(swing?.instruments ?? {})) {
    if (prof.enabled) await scanSwing(key, prof, state, out).catch(e => log.error(`swing ${key}: ${e.message}`));
  }
  for (const [key, prof] of Object.entries(intraday?.instruments ?? {})) {
    if (prof.enabled) await scanIntraday(key, prof, state, out).catch(e => log.error(`intraday ${key}: ${e.message}`));
  }
  await saveState(state);
  for (const m of out) await sendTelegram(m);
  return out;
}

export function enabledSummary(swing, intraday) {
  const list = [];
  for (const [k, p] of Object.entries(swing?.instruments ?? {})) list.push({ playbook: 'swing', key: k, enabled: p.enabled, holdoutWinRate: p.holdout?.winRate, n: p.holdout?.n });
  for (const [k, p] of Object.entries(intraday?.instruments ?? {})) list.push({ playbook: 'intraday', key: k, enabled: p.enabled, holdoutWinRate: p.holdout?.winRate, n: p.holdout?.n });
  return list;
}

export async function signalsStatus() {
  const [swing, intraday, state] = await Promise.all([
    readJson(new URL('swing-profile.json', DATA), null),
    readJson(new URL('signal-profile.json', DATA), null),
    loadState()
  ]);
  return { playbooks: enabledSummary(swing, intraday), open: state.open, closed: state.closed.slice(-50) };
}
