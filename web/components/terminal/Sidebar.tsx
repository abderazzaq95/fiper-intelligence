'use client';

import { Fragment } from 'react';
import styles from './terminal.module.css';
import { NAV, type ScreenKey } from '@/lib/terminal/routes';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* DOM stays flat (Fragment per group, not a wrapping <div>) because the
   original's .side is `display:flex;flex-direction:column;gap:2px` with
   .side-group headers and .nav-item buttons as direct siblings — wrapping
   each group in its own element would change the gap spacing. */
export function Sidebar({ active, onSelect, open }: { active: ScreenKey; onSelect: (k: ScreenKey) => void; open: boolean }) {
  const S = useMarketData();
  const { t } = useLanguage();
  const newsCount = S.news.filter((n) => n.imp === 'HIGH').length;

  return (
    <nav className={`${styles.side} ${open ? styles.open : ''}`} id="side">
      {NAV.map((g) => (
        <Fragment key={g.group}>
          <div className={styles['side-group']}>{t.common.navGroup[g.group as keyof typeof t.common.navGroup]}</div>
          {g.items.map((it) => (
            <button
              key={it.key}
              type="button"
              className={`${styles['nav-item']} ${active === it.key ? styles.active : ''}`}
              onClick={() => onSelect(it.key)}
            >
              <span className={styles['nav-ico']}>{it.icon}</span>
              {t.common.navLabel[it.key]}
              {it.tag && <span className={styles['nav-tag']}>{newsCount}</span>}
            </button>
          ))}
        </Fragment>
      ))}
    </nav>
  );
}
