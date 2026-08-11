/* ══════════ BIAS ENGINE ══════════
   Ported verbatim (logic unchanged) from fiper-terminal.html.
   Derives direction from live inputs where they exist: risk appetite,
   dollar direction, and each asset's own momentum. Kept as separate
   pure functions returning their inputs (momentum, riskTilt, dollarTilt,
   positioning) as distinct fields so the UI can display *why*, not just
   the verdict — this is the explainability constraint from CLAUDE.md.

   `reason.t` intentionally still carries the original's small inline
   HTML (`<b style="color:...">…</b>`) — it's static, computed-only
   content (never user input), so screens render it via
   dangerouslySetInnerHTML rather than hand-rewriting every string into
   JSX fragments, which would risk drifting from the ported wording. */

import type { MarketState } from './marketData';
import { num, sign } from './format';

export interface Bias {
  dir: 'Bullish' | 'Bearish' | 'Neutral';
  swing: string;
  day: string;
  conf: number;
  score: number;
}

export interface Reason {
  i: string;
  c: string;
  t: string;
}

export function computeRisk(S: MarketState): void {
  const btc = S.crypto.BTCUSD?.chg ?? 0;
  const nq = S.quotes.NQUSD?.chg ?? 0;
  const gold = S.quotes.XAUUSD?.chg ?? 0;
  const oil = S.quotes.USOIL?.chg ?? 0;
  // risk-on: equities + crypto + oil up, gold down
  const raw = nq * 2.2 + btc * 1.1 + oil * 0.6 - gold * 1.4;
  S.risk = Math.max(4, Math.min(96, 50 + raw * 5));
  S.themes = [
    { n: 'Inflation', v: Math.abs(gold) * 14 + 22, c: 'var(--bear)' },
    { n: 'Growth', v: 50 + nq * 7, c: 'var(--green)' },
    { n: 'Geopolitics', v: 30 + Math.abs(oil) * 8, c: 'var(--amber)' },
    { n: 'Rates', v: 44 + (S.quotes.DXY?.chg ?? 0) * 9, c: '#5B9BFF' },
  ].map((t) => ({ ...t, v: Math.max(8, Math.min(96, t.v)) }));
}

export function biasFor(S: MarketState, sym: string): Bias | null {
  const q = S.quotes[sym] || S.crypto[sym];
  if (!q) return null;
  const risk = S.risk;
  const chg = q.chg;
  const isHaven = sym === 'XAUUSD';
  const score = chg * 10 + (isHaven ? (50 - risk) * 0.5 : (risk - 50) * 0.5);
  const dir = score > 12 ? 'Bullish' : score < -12 ? 'Bearish' : 'Neutral';
  const swing = score > 22 ? 'Bullish' : score > 6 ? 'Slightly Bullish' : score < -22 ? 'Bearish' : score < -6 ? 'Slightly Bearish' : 'Neutral';
  const day = chg > 0.9 ? 'Bullish' : chg > 0.15 ? 'Slightly Bullish' : chg < -0.9 ? 'Bearish' : chg < -0.15 ? 'Slightly Bearish' : 'Neutral';
  return { dir, swing, day, conf: Math.min(94, 46 + Math.abs(score) * 1.5), score };
}

export const bcls = (b: string): 'bull' | 'bear' | 'neutral' => (b.includes('Bull') ? 'bull' : b.includes('Bear') ? 'bear' : 'neutral');

export function buildReasons(S: MarketState, sym: string, b: Bias, q: { chg: number }): Reason[] {
  const R: Reason[] = [];
  const risk = S.risk;
  R.push(
    q.chg > 0
      ? { i: '▲', c: 'var(--green)', t: `<b style="color:var(--text)">${sym}</b> is up ${num(q.chg)}% on the session, keeping short-term momentum constructive.` }
      : { i: '▼', c: 'var(--bear)', t: `<b style="color:var(--text)">${sym}</b> is down ${num(Math.abs(q.chg))}% on the session, so intraday momentum is against longs.` }
  );
  R.push(
    risk > 62
      ? { i: '◉', c: 'var(--green)', t: `Risk appetite reads <b style="color:var(--text)">${Math.round(risk)}/100</b> — equities and crypto are leading, which favours cyclical exposure over havens.` }
      : risk < 38
      ? { i: '◉', c: 'var(--bear)', t: `Risk appetite reads <b style="color:var(--text)">${Math.round(risk)}/100</b> — defensive flows dominate, which favours gold and the dollar over equities.` }
      : { i: '◉', c: 'var(--amber)', t: `Risk appetite is balanced at <b style="color:var(--text)">${Math.round(risk)}/100</b>, so macro is not currently the dominant driver.` }
  );
  const dxy = S.quotes.DXY?.chg ?? 0;
  if (sym !== 'DXY')
    R.push(
      dxy > 0
        ? { i: '$', c: 'var(--bear)', t: `The dollar index is firmer (${sign(dxy)}%), a headwind for dollar-denominated assets.` }
        : { i: '$', c: 'var(--green)', t: `The dollar index is softer (${sign(dxy)}%), which is generally supportive here.` }
    );
  const hi = S.news.filter((n) => n.imp === 'HIGH' && n.t.some((t) => t.startsWith(sym.slice(0, 3))));
  if (hi.length)
    R.push({ i: '◈', c: 'var(--red-hi)', t: `<b style="color:var(--text)">${hi.length}</b> high-impact ${hi.length > 1 ? 'headlines' : 'headline'} in the feed reference this market directly.` });
  const up = S.events.filter((e) => !e.released && e.imp === 'HIGH');
  if (up.length)
    R.push({ i: '▤', c: 'var(--amber)', t: `<b style="color:var(--text)">${up[0].n}</b> (${up[0].ccy}) is still to come at ${up[0].t} — size positions with that in mind.` });
  return R;
}
