/**
 * npm run gold:import-exness [-- path/to/Exness_XAUUSDm_2024.zip ...]
 *
 * Converts Exness tick history (the yearly zips Exness publishes, one CSV
 * of "Exness","Symbol","Timestamp","Bid","Ask" per year) into the lab's
 * monthly 1-minute bid/ask files in data/gold/exness-m1/.
 *
 * This is the broker the strategy will trade on, so its spreads and
 * quotes are the ground truth — better than any third-party feed.
 *
 * Streams each zip through Windows' bsdtar (it reads zip; Git Bash's GNU
 * tar does not), so the multi-GB CSVs never touch the disk.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';

const OUT = 'data/gold/exness-m1';
const TAR = existsSync('C:/Windows/System32/tar.exe') ? 'C:/Windows/System32/tar.exe' : 'bsdtar';
const HEADER = 't,bo,bh,bl,bc,ao,ah,al,ac,v';

let zips = process.argv.slice(2);
if (!zips.length) zips = (await readdir('.')).filter(f => /^Exness_XAUUSD.*\.zip$/i.test(f)).sort();
if (!zips.length) throw new Error('no Exness_XAUUSD*.zip files found in the project folder');
await mkdir(OUT, { recursive: true });

const r3 = v => Math.round(v * 1000) / 1000;

for (const zip of zips) {
  console.log(`\n${zip}`);
  const tar = spawn(TAR, ['-xOf', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  const closed = new Promise(r => tar.on('close', r)); // listen before reading, or a fast exit is missed
  const rl = createInterface({ input: tar.stdout, crlfDelay: Infinity });

  let monthKey = null, rows = [], bar = null, minuteKey = null, minuteT = 0, ticks = 0, bad = 0;
  const spreads = [];
  const flushBar = () => {
    if (!bar) return;
    rows.push(`${minuteT},${r3(bar.bo)},${r3(bar.bh)},${r3(bar.bl)},${r3(bar.bc)},${r3(bar.ao)},${r3(bar.ah)},${r3(bar.al)},${r3(bar.ac)},${bar.v}`);
    if (rows.length % 7 === 0) spreads.push(bar.ac - bar.bc);
    bar = null;
  };
  const flushMonth = async () => {
    flushBar();
    if (!monthKey || !rows.length) return;
    await writeFile(`${OUT}/${monthKey}.csv.gz`, gzipSync(`${HEADER}\n${rows.join('\n')}\n`));
    spreads.sort((a, b) => a - b);
    console.log(`  ${monthKey}: ${rows.length} min bars, spread median ${spreads[spreads.length >> 1]?.toFixed(3)} p95 ${spreads[Math.floor(spreads.length * 0.95)]?.toFixed(3)}`);
    rows = []; spreads.length = 0;
  };

  for await (const line of rl) {
    // "exness","XAUUSDm","2026-01-01 23:05:00.141Z",4328.321,4328.481
    const q1 = line.indexOf('"', line.indexOf('"', line.indexOf('"', line.indexOf('"', line.indexOf('"') + 1) + 1) + 1) + 1);
    if (q1 < 0 || line.charCodeAt(q1 + 1) < 48 || line.charCodeAt(q1 + 1) > 57) continue; // header or junk
    const ts = line.slice(q1 + 1, q1 + 17);                // "2026-01-01 23:05" — the minute
    const rest = line.slice(line.indexOf('"', q1 + 1) + 2).split(',');
    const bid = +rest[0], ask = +rest[1];
    if (!(bid > 0 && ask >= bid)) { bad++; continue; }
    ticks++;
    if (ts !== minuteKey) {
      flushBar();
      const mk = ts.slice(0, 7);
      if (mk !== monthKey) { await flushMonth(); monthKey = mk; }
      minuteKey = ts;
      minuteT = Date.UTC(+ts.slice(0, 4), +ts.slice(5, 7) - 1, +ts.slice(8, 10), +ts.slice(11, 13), +ts.slice(14, 16)) / 1000;
    }
    if (!bar) bar = { bo: bid, bh: bid, bl: bid, bc: bid, ao: ask, ah: ask, al: ask, ac: ask, v: 0 };
    if (bid > bar.bh) bar.bh = bid; if (bid < bar.bl) bar.bl = bid; bar.bc = bid;
    if (ask > bar.ah) bar.ah = ask; if (ask < bar.al) bar.al = ask; bar.ac = ask;
    bar.v++;
  }
  await flushMonth();
  await closed;
  console.log(`  ${ticks.toLocaleString()} ticks${bad ? `, ${bad} malformed skipped` : ''}`);
}
console.log(`\nDone. Monthly files in ${OUT}`);
