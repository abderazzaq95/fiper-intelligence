import { readdir, readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

/**
 * 10 years of XAUUSD minutes in typed arrays (~70 MB for ~3.5M bars).
 * Prices are BID; `sp` is the ask−bid spread at the minute's close, so
 * ask ≈ bid + sp. Float32 keeps gold's 3 decimals exact enough (error
 * < 0.001 at $4,000) while halving memory.
 */
export async function loadM1(dir = new URL('../../../data/gold/m1/', import.meta.url)) {
  const files = (await readdir(dir)).filter(f => f.endsWith('.csv.gz')).sort();
  if (!files.length) throw new Error(`no gold data in ${dir} — run: npm run gold:pull`);
  const chunks = [];
  let n = 0;
  for (const f of files) {
    const text = gunzipSync(await readFile(new URL(f, dir))).toString('utf8');
    const lines = text.split('\n');
    const rows = [];
    for (let i = 1; i < lines.length; i++) if (lines[i]) rows.push(lines[i]);
    chunks.push(rows); n += rows.length;
  }
  const m = {
    n, t: new Int32Array(n),
    o: new Float32Array(n), h: new Float32Array(n), l: new Float32Array(n), c: new Float32Array(n),
    sp: new Float32Array(n)
  };
  let k = 0;
  for (const rows of chunks) for (const r of rows) {
    const p = r.split(',');
    m.t[k] = +p[0]; m.o[k] = +p[1]; m.h[k] = +p[2]; m.l[k] = +p[3]; m.c[k] = +p[4];
    m.sp[k] = Math.max(0, +p[8] - +p[4]);
    k++;
  }
  return m;
}

/* ---------- market clocks ---------- */

const offsetCache = new Map();
/** UTC offset (minutes) of a timezone on the UTC day containing tSec. Cached per day. */
function tzOffset(tSec, tz) {
  const day = Math.floor(tSec / 86400);
  const key = `${tz}|${day}`;
  let off = offsetCache.get(key);
  if (off === undefined) {
    // Noon UTC is clear of every DST switch, which happen on Sunday nights while gold is shut
    const d = new Date((day * 86400 + 43200) * 1000);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(d).map(x => [x.type, +x.value || x.value]));
    const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    off = Math.round((local - d.getTime()) / 60000);
    offsetCache.set(key, off);
  }
  return off;
}

/** Minutes since local midnight + local day number, for London or New York. */
export function clock(tSec, tz) {
  const local = tSec + tzOffset(tSec, tz) * 60;
  return { min: Math.floor((local % 86400) / 60), day: Math.floor(local / 86400), dow: (Math.floor(local / 86400) + 4) % 7 };
}
export const LONDON = 'Europe/London';
export const NEWYORK = 'America/New_York';

/**
 * Gold's trading day runs 17:00 → 17:00 New York time. Returns a day key
 * that changes at that boundary, so "yesterday's high/low" means what
 * every gold trader means by it.
 */
export function goldDay(tSec) {
  const c = clock(tSec, NEWYORK);
  return c.min >= 17 * 60 ? c.day + 1 : c.day;
}

/* ---------- aggregation ---------- */

/**
 * Bars of `tf` minutes (aligned to UTC), each remembering which minutes
 * it was built from so trades can be replayed minute by minute.
 */
export function aggregate(m, tf) {
  const t = [], o = [], h = [], l = [], c = [], sp = [], i0 = [], i1 = [];
  let cur = -1;
  for (let i = 0; i < m.n; i++) {
    const b = Math.floor(m.t[i] / (tf * 60));
    if (b !== cur) {
      cur = b;
      t.push(b * tf * 60); o.push(m.o[i]); h.push(m.h[i]); l.push(m.l[i]); c.push(m.c[i]); sp.push(m.sp[i]); i0.push(i); i1.push(i);
    } else {
      const k = t.length - 1;
      if (m.h[i] > h[k]) h[k] = m.h[i];
      if (m.l[i] < l[k]) l[k] = m.l[i];
      c[k] = m.c[i]; sp[k] = m.sp[i]; i1[k] = i;
    }
  }
  return { n: t.length, tf, t, o, h, l, c, sp, i0, i1 };
}

/** Daily bars on gold's 17:00 New York session boundary. */
export function dailyBars(m) {
  const t = [], o = [], h = [], l = [], c = [], i0 = [], i1 = [], key = [];
  let cur = null;
  for (let i = 0; i < m.n; i++) {
    const d = goldDay(m.t[i]);
    if (d !== cur) {
      cur = d;
      key.push(d); t.push(m.t[i]); o.push(m.o[i]); h.push(m.h[i]); l.push(m.l[i]); c.push(m.c[i]); i0.push(i); i1.push(i);
    } else {
      const k = t.length - 1;
      if (m.h[i] > h[k]) h[k] = m.h[i];
      if (m.l[i] < l[k]) l[k] = m.l[i];
      c[k] = m.c[i]; i1[k] = i;
    }
  }
  return { n: t.length, t, o, h, l, c, i0, i1, key };
}

/** First minute index with t >= tSec (binary search). */
export function indexAt(m, tSec) {
  let lo = 0, hi = m.n;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (m.t[mid] < tSec) lo = mid + 1; else hi = mid; }
  return lo;
}
