/* ══════════════════════════════════════════════════════════════
   Deterministic pseudo-random generator, ported verbatim from
   fiper-terminal.html so "modelled" numbers stay stable across reloads.
   Original:
     let _seed = 20260809;
     function rnd(){ _seed=(_seed*1664525+1013904223)%4294967296; return _seed/4294967296; }
     const pick = a => a[Math.floor(rnd()*a.length)];
     const between = (a,b) => a + rnd()*(b-a);

   IMPORTANT — call-order sensitivity: every "modelled fallback" function
   in marketData.ts/candles.ts/backtest.ts draws from this ONE running
   sequence. MarketDataProvider must invoke the seed functions in the
   exact order the original boot() did, exactly once (guarded against
   React Strict Mode's double-invoke), or the modelled numbers diverge
   from the original render.

   setSeed() exists because the original's runBacktest() itself reseeds
   the shared `_seed` variable from a hash of its inputs (so backtests are
   deterministic per query) — that reseed is a deliberate (if quirky)
   part of the original: it also permanently mutates the shared sequence
   for anything that runs after it. Ported as-is via setSeed().
══════════════════════════════════════════════════════════════ */

let _seed = 20260809;

export function rnd(): number {
  _seed = (_seed * 1664525 + 1013904223) % 4294967296;
  return _seed / 4294967296;
}

export function pick<T>(a: T[]): T {
  return a[Math.floor(rnd() * a.length)];
}

export function between(a: number, b: number): number {
  return a + rnd() * (b - a);
}

export function setSeed(n: number): void {
  _seed = n >>> 0;
}

export function getSeed(): number {
  return _seed;
}
