'use client';

import { useId } from 'react';

/* Ported from spark(vals,color,w,h) — built an SVG string via template
   literals in the original; here it returns JSX directly. Gradient id
   uses useId() instead of Math.random() (SSR-safe, still unique per
   mounted instance — doesn't touch the shared deterministic PRNG). */
export function SparkLine({ vals, color, w = 190, h = 34 }: { vals?: number[]; color: string; w?: number; h?: number }) {
  const rawId = useId();
  if (!vals || vals.length < 2) return null;

  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const r = mx - mn || 1;
  const pts = vals.map((v, i): [number, number] => [(i / (vals.length - 1)) * w, h - 2 - ((v - mn) / r) * (h - 5)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const gid = 'spark-' + rawId.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.32} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
