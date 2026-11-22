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
 * Runs in GitHub Actions (see .github/workflows/gold-data.yml), not on a
 * workstation. Needs the `xz` CLI for LZMA (preinstalled on ubuntu runners).
 *
 * node scripts/gold/fetch-dukascopy.js <outDir> [fromYear]
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const OUT = process.argv[2] || 'data/gold/m1';
const FROM_YEAR = Number(process.argv[3] || new Date().getUTCFullYear() - 10);
const BASE = 'https://datafeed.dukascopy.com/datafeed/XAUUSD';
const CONCURRENCY = 6;      // polite: a public free feed, not a paid API
const DIVISOR = 1000;       // XAUUSD is quoted to 3 decimals in the feed
const DAY = 86400_000;

const pad = n => String(n).padStart(2, '0');
const exists = p => access(p).then(() => true, () => false);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function download(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt === 3) throw new Error(`${url}: ${e.message}`);
      await sleep(1000 * 2 ** attempt);
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

async function fetchDay(date) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth(), dd = date.getUTCDate();
  const path = `${BASE}/${y}/${pad(m)}/${pad(dd)}`; // month is 0-based in the feed
  const start = Date.UTC(y, m, dd) / 1000;
  const [bid, ask] = await Promise.all([download(`${path}/BID_candles_min_1.bi5`), download(`${path}/ASK_candles_min_1.bi5`)]);
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

async function fetchMonth(y, m) {
  const days = [];
  for (let t = Date.UTC(y, m, 1); new Date(t).getUTCMonth() === m && t < Date.now() - DAY; t += DAY) days.push(new Date(t));
  const results = new Array(days.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < days.length) { const i = next++; results[i] = await fetchDay(days[i]); }
  }));
  return results.flat();
}

await mkdir(OUT, { recursive: true });
const now = new Date();
const summary = [];
for (let y = FROM_YEAR; y <= now.getUTCFullYear(); y++) {
  for (let m = 0; m < 12; m++) {
    if (Date.UTC(y, m, 1) > Date.now()) break;
    const file = `${OUT}/${y}-${pad(m + 1)}.csv.gz`;
    const isCurrent = y === now.getUTCFullYear() && m === now.getUTCMonth();
    // Finished months never change — only the current one is re-fetched
    if (!isCurrent && await exists(file)) continue;
    const rows = await fetchMonth(y, m);
    if (!rows.length) { console.log(`${y}-${pad(m + 1)}: no data`); continue; }
    const mids = rows.map(r => { const p = r.split(','); return (+p[4] + +p[8]) / 2; }).sort((a, b) => a - b);
    const spreads = rows.map(r => { const p = r.split(','); return +p[8] - +p[4]; }).sort((a, b) => a - b);
    const med = mids[mids.length >> 1];
    // Sanity gate: a wrong divisor or a broken parse shows up as an absurd gold price
    if (!(med > 500 && med < 20000)) throw new Error(`${y}-${pad(m + 1)}: median price ${med} is not gold — parse error`);
    await writeFile(file, gzipSync('t,bo,bh,bl,bc,ao,ah,al,ac,v\n' + rows.join('\n') + '\n'));
    const line = `${y}-${pad(m + 1)}: ${rows.length} min bars, median ${med.toFixed(2)}, spread median ${spreads[spreads.length >> 1].toFixed(3)} p95 ${spreads[Math.floor(spreads.length * 0.95)].toFixed(3)}`;
    console.log(line);
    summary.push(line);
  }
}
console.log(`\ndone — ${summary.length} month file(s) written to ${OUT}`);
