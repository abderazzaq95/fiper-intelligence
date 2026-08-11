'use client';

import { useState } from 'react';
import styles from './terminal.module.css';
import type { NewsItem } from '@/lib/terminal/marketData';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Dictionary } from '@/lib/i18n/dictionaries';

/* Local replacement for format.ts's ago() — same minute/hour math, but
   rendered through the translated t.common.ago strings instead of
   hardcoded English. format.ts's own ago() is left untouched (per
   CLAUDE.md constraint) and simply isn't called from here anymore. */
function agoText(ts: number, t: Dictionary): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return t.common.ago.justNow;
  if (m < 60) return t.common.ago.minAgo(m);
  const h = Math.floor(m / 60);
  return t.common.ago.hourMinAgo(h, m % 60);
}

/* Ported from newsCard(n, expandable) + the click-to-expand handler that
   toggled the `.open` class in renderFullFeed(). */
export function NewsCard({ n, expandable }: { n: NewsItem; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div
      className={`${styles['news-item']} ${expandable && open ? styles.open : ''}`}
      onClick={expandable ? () => setOpen((o) => !o) : undefined}
      role={expandable ? 'button' : undefined}
      tabIndex={expandable ? 0 : undefined}
    >
      <div className={styles['ni-top']}>
        <span className={`${styles.pill} ${styles[n.imp.toLowerCase()]}`}>{t.common.impact[n.imp]} {t.common.impactSuffix}</span>
        <span className={styles['ni-time']}>{agoText(n.ts, t)}</span>
      </div>
      <div className={styles['ni-head']}>{n.h}</div>
      <div className={styles['ni-sum']}>{n.s}</div>
      <div className={styles['ni-tags']}>
        {n.t.map((tag, i) => (
          <span key={i} className={`${styles.tag} ${styles[tag.includes('↑') ? 'up' : 'down']}`}>{tag}</span>
        ))}
      </div>
      {expandable && (
        <div className={styles['ni-more']}>
          <strong style={{ color: 'var(--text)' }}>{t.terminal.headlines.whyItMatters}</strong> {n.full}
        </div>
      )}
    </div>
  );
}
