/**
 * Downloads XAUUSD 1-minute BID and ASK candles from Dukascopy's public
 * datafeed (built from their tick data) and stores one gzipped CSV per
 * month:
 *
 *   t,bo,bh,bl,bc,ao,ah,al,ac,v      (t = unix seconds, UTC; bid + ask OHLC)
 *
 * Bid AND ask matter: a long is filled at the ask and stopped on the bid,
 * so the spread — which on gold widens hard at the daily rollover and
 * around news — is charged exactly as a broker would charge it.
 *
 * Built to respect a throttled feed. Dukascopy rate-limits (HTTP 503),
 * and we stay inside that limit rather than around it:
 *   - one request at a time, with long back-offs when told to slow down
 *   - months are saved even with holes; the failed days are listed in
 *     YYYY-MM.missing and only those are fetched on the next run
 *   - when the feed keeps refusing, the job saves, pushes and stops
 *     cleanly; the scheduled workflow resumes later
 *
 * Runs in GitHub Actions (see .github/workflows/gold-data.yml), not on a
 * workstation. Needs the `xz` CLI for LZMA (preinstalled on ubuntu runners).
 *
 * node scripts/gold/fetch-dukascopy.js <outDir> <fromYear> [toYear] [--commit-every N]
 */
import { mkdir, writeFile, readFile, access, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';

const OUT = process.argv[2] || 'data/gold/m1';
const FROM_YEAR = Number(process.argv[3] || new Date().getUTCFullYear() - 10);
const TO_YEAR = Number(/^\d{4}$/.test(process.argv[4] ?? '') ? process.argv[4] : new Date().getUTCFullYear());
const ceArg = process.argv.indexOf('--commit-every');
const COMMIT_EVERY = ceArg > 0 ? Number(process.argv[ceArg + 1]) : 0;

const BASE = 'https://datafeed.dukascopy.com/datafeed/XAUUSD';
const PAUSE_MS = 250;        // between requests — one request at a time per runner
const ATTEMPTS = 5;          // per file, with long waits: 503 means "slow down", not "gone"
const GIVE_UP_AFTER = 8;     // files failing back-to-back → the feed has shut us out for now
const DIVISOR = 1000;        // XAUUSD is quoted to 3 decimals in the feed
const DAY = 86400_000;
const HEADER = 't,bo,bh,bl,bc,ao,ah,al,ac,v';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const pad = n => String(n).padStart(2, '0');
const exists = p => access(p).then(() => true, () => false);
const sleep = ms => new Promise(r => setTimeout(r, ms));
class FeedBlocked extends Error {}

/* ---------------- download ---------------- */

let consecutiveFailures = 0;
/** Buffer on success, null when the file does not exist (weekend/holiday), undefined when it failed. */
async function download(url) {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await sleep(PAUSE_MS);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) { consecutiveFailures = 0; return null; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      consecutiveFailures = 0;
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt < ATTEMPTS - 1) { await sleep([10, 20, 40, 60][attempt] * 1000); continue; }
      if (++consecutiveFailures >= GIVE_UP_AFTER) throw new FeedBlocked(`${GIVE_UP_AFTER} files failed in a row (last ${e.message})`);
      console.warn(`  skip ${url.split('XAUUSD/')[1]}: ${e.message}`);
      return undefined;
    }
  }
}

/** bi5 = raw LZMA ("alone" format); records are 24 bytes, big-endian. */
function parseCandles(buf, dayStartSec) {
  if (!buf || buf.length === 0) return [];
  const r = spawnSync('xz', ['--format=lzma', '--decompress', '--stdout'], { input: buf, maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`xz failed: ${r.stderr}`);
  const d = r.stdout, out = [];
  for (let off = 0; off + 24 <= d.length; off += 24) {
    // Dukascopy candle order is open, CLOSE, low, high — not OHLC
    out.push({
      t: dayStartSec + d.readUInt32BE(off),
      o: d.readUInt32BE(off + 4) / DIVISOR,
      c: d.readUInt32BE(off + 8) / DIVISOR,
      l: d.readUInt32BE(off + 12) / DIVISOR,
      h: d.readUInt32BE(off + 16) / DIVISOR,
      v: d.readFloatBE(off + 20)
    });
  }
  return out;
}

/** Rows for one UTC day, or null if the day could not be fetched. */
async function fetchDay(y, m, dd) {
  const path = `${BASE}/${y}/${pad(m)}/${pad(dd)}`; // month is 0-based in the feed
  const start = Date.UTC(y, m, dd) / 1000;
  const bid = await download(`${path}/BID_candles_min_1.bi5`);
  if (bid === undefined) return null;
  if (bid === null) return [];
  const ask = await download(`${path}/ASK_candles_min_1.bi5`);
  if (ask === undefined) return null;
  const b = parseCandles(bid, start), a = parseCandles(ask, start);
  const askByT = new Map(a.map(k => [k.t, k]));
  const rows = [];
  for (const k of b) {
    const q = askByT.get(k.t);
    // Dukascopy fills closed-market minutes with flat zero-volume candles — drop them
    if (!q || (k.v === 0 && k.o === k.c && k.h === k.l)) continue;
    rows.push(`${k.t},${k.o},${k.h},${k.l},${k.c},${q.o},${q.h},${q.l},${q.c},${Math.round(k.v * 100) / 100}`);
  }
  return rows;
}

/* ---------------- month files ---------------- */

const fileOf = (y, m) => `${OUT}/${y}-${pad(m + 1)}.csv.gz`;
const missingOf = (y, m) => `${OUT}/${y}-${pad(m + 1)}.missing`;

async function readRows(file) {
  const lines = gunzipSync(await readFile(file)).toString('utf8').split('\n');
  return lines.slice(1).filter(Boolean);
}

function daysOf(y, m) {
  const out = [];
  for (let t = Date.UTC(y, m, 1); new Date(t).getUTCMonth() === m && t < Date.now() - DAY; t += DAY) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 6) out.push(new Date(t).getUTCDate()); // Saturdays never trade — skip the requests
  }
  return out;
}

/**
 * Brings one month up to date. Returns 'complete' | 'partial' | 'skipped'.
 * Throws FeedBlocked after saving whatever it got, so nothing is lost.
 */
async function syncMonth(y, m) {
  const file = fileOf(y, m), missFile = missingOf(y, m);
  const isCurrent = y === new Date().getUTCFullYear() && m === new Date().getUTCMonth();
  const hasFile = await exists(file), hasMissing = await exists(missFile);
  if (hasFile && !hasMissing && !isCurrent) return 'skipped';

  let todo = daysOf(y, m);
  let rows = [];
  if (hasFile && hasMissing && !isCurrent) {
    todo = (await readFile(missFile, 'utf8')).split(/\s+/).filter(Boolean).map(Number);
    rows = await readRows(file);
  }

  const failed = [];
  let blocked = null;
  for (const dd of todo) {
    try {
      const r = await fetchDay(y, m, dd);
      if (r === null) failed.push(dd); else rows.push(...r);
    } catch (e) {
      if (!(e instanceof FeedBlocked)) throw e;
      blocked = e;
      failed.push(...todo.slice(todo.indexOf(dd)));
      break;
    }
  }

  if (rows.length) {
    rows = [...new Map(rows.map(r => [r.slice(0, r.indexOf(',')), r])).values()]
      .sort((a, b) => +a.slice(0, a.indexOf(',')) - +b.slice(0, b.indexOf(',')));
    const mid = rows.map(r => { const p = r.split(','); return (+p[4] + +p[8]) / 2; }).sort((a, b) => a - b);
    const spr = rows.map(r => { const p = r.split(','); return +p[8] - +p[4]; }).sort((a, b) => a - b);
    const med = mid[mid.length >> 1];
    // Sanity gate: a wrong divisor or a broken parse shows up as an absurd gold price
    if (!(med > 500 && med < 20000)) throw new Error(`${y}-${pad(m + 1)}: median price ${med} is not gold — parse error`);
    await writeFile(file, gzipSync(`${HEADER}\n${rows.join('\n')}\n`));
    console.log(`${y}-${pad(m + 1)}: ${rows.length} min bars, median ${med.toFixed(2)}, spread median ${spr[spr.length >> 1].toFixed(3)} p95 ${spr[Math.floor(spr.length * 0.95)].toFixed(3)}${failed.length ? `, ${failed.length} day(s) still missing` : ''}`);
  }
  if (failed.length) await writeFile(missFile, failed.join(' ') + '\n');
  else if (hasMissing) await unlink(missFile);
  if (blocked) throw blocked;
  return failed.length ? 'partial' : 'complete';
}

/* ---------------- checkpoints (CI) ---------------- */

/** Commit + push the data worktree. Parallel year jobs push to one branch, so rebase and retry. */
function checkpoint(msg) {
  const cwd = dirname(resolve(OUT));
  const git = (...a) => spawnSync('git', a, { cwd, stdio: 'inherit' }).status;
  git('add', '-A');
  if (git('diff', '--cached', '--quiet') === 0) return;
  git('commit', '-q', '-m', msg);
  for (let i = 0; i < 6; i++) {
    if (git('push', '-q', 'origin', 'HEAD:refs/heads/data-xauusd') === 0) return;
    // Another year's job pushed first — its files never overlap ours, so a rebase is always clean
    git('fetch', '-q', 'origin', 'data-xauusd');
    git('rebase', '-q', 'FETCH_HEAD');
    spawnSync('sleep', [String(2 + Math.random() * 8)]);
  }
  console.warn('checkpoint push failed after retries');
}

/* ---------------- main ---------------- */

await mkdir(OUT, { recursive: true });
let saved = 0, stoppedEarly = null;
// Newest first: today's gold (price level, volatility, spreads) is what a
// live strategy trades, so the most relevant data should arrive first
outer:
for (let y = TO_YEAR; y >= FROM_YEAR; y--) {
  for (let m = 11; m >= 0; m--) {
    if (Date.UTC(y, m, 1) > Date.now()) continue;
    try {
      const r = await syncMonth(y, m);
      if (r !== 'skipped') saved++;
    } catch (e) {
      if (!(e instanceof FeedBlocked)) throw e;
      stoppedEarly = e.message;
      saved++;
      break outer;
    }
    if (COMMIT_EVERY && saved && saved % COMMIT_EVERY === 0) checkpoint(`XAUUSD M1 ${y}-${pad(m + 1)}`);
  }
}
if (COMMIT_EVERY) checkpoint(`XAUUSD M1 ${FROM_YEAR}–${TO_YEAR} ${stoppedEarly ? 'partial' : 'sync'}`);
console.log(stoppedEarly
  ? `\nfeed throttled us (${stoppedEarly}) — progress saved, the next scheduled run resumes`
  : `\ndone — ${saved} month(s) updated for ${FROM_YEAR}–${TO_YEAR}`);
