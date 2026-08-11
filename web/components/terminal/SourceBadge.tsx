'use client';

import styles from './terminal.module.css';
import type { SrcMode } from '@/lib/terminal/marketData';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* The LIVE/MODEL badge — one reusable component so every widget declares
   live vs demo explicitly (CLAUDE.md hard constraint, not cosmetic).
   Mirrors the original's setSrc(el, mode, label): green "Live" for
   mode==='live', amber "Model" for 'demo', dim '…' while 'wait'ing.
   'stale' is new — the backend explicitly flags served-but-expired cache
   (CLAUDE.md: "stale beats empty") and that deserves a visibly different
   badge from a clean live tick, not silence.

   `label`, when passed explicitly by a caller (e.g. "Binance Live", "ECB
   Live"), is expected to already be one of the exact English keys of
   t.common.badge — looked up here so callers keep passing the same
   English literal they always did (see SourceBadge call sites). */
export function SourceBadge({ mode, label, className }: { mode: SrcMode | undefined; label?: string; className?: string }) {
  const { t } = useLanguage();
  const m: SrcMode = mode ?? 'wait';
  const defaultText = m === 'live' ? t.common.badge.Live : m === 'stale' ? t.common.badge.Stale : m === 'demo' ? t.common.badge.Model : '…';
  const text = label ? t.common.badge[label as keyof typeof t.common.badge] ?? label : defaultText;
  return <span className={`${styles.src} ${styles[m]} ${className ?? ''}`}>{text}</span>;
}
