/* Small formatting helpers ported verbatim from fiper-terminal.html.
   Not called out as their own file in the migration plan's file tree, but
   needed by nearly every screen/component (bias.ts, candles.ts,
   backtest.ts, NewsCard, SparkLine, all screens) — kept as one shared
   module rather than duplicated inline. */

export const num = (n: number, d = 2): string =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const sign = (n: number): string => (n > 0 ? '+' : '') + num(n, 2);

export const cls = (n: number): 'up' | 'down' | 'flat' => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');

// ↑/↓ are vertical (price direction, not reading direction) and never
// flip for RTL. The flat-state '→' is the one ambiguous case — it's a
// horizontal glyph that could misread as "increasing" in an RTL context.
// `dir` is optional and defaults to the original behavior exactly (zero
// risk to existing English rendering); pass 'rtl' to get a neutral glyph
// instead for the flat case only.
export const arrow = (n: number, dir?: 'ltr' | 'rtl'): string =>
  n > 0 ? '↑' : n < 0 ? '↓' : dir === 'rtl' ? '–' : '→';

export function ago(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm ago';
}
