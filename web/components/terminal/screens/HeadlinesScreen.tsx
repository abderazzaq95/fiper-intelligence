'use client';

import { useState } from 'react';
import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { NewsCard } from '../NewsCard';
import { ChipGroup } from '../ChipGroup';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const CATS = ['all', 'forex', 'indices', 'commodities', 'crypto'] as const;
type Cat = (typeof CATS)[number];

/* Ported from #s-headlines + renderFullFeed(). newsFilter is local state
   here (was a module-level variable in the original) — since this screen
   stays mounted for the app's whole lifetime just like every other
   screen, that's an equivalent persistence guarantee. */
export function HeadlinesScreen() {
  const S = useMarketData();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Cat>('all');

  const labels: Record<Cat, string> = {
    all: t.terminal.headlines.all,
    forex: t.terminal.headlines.forex,
    indices: t.terminal.headlines.indices,
    commodities: t.terminal.headlines.commodities,
    crypto: t.terminal.headlines.crypto,
  };

  const list = S.news.filter((n) => filter === 'all' || n.cat === filter);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <ChipGroup options={CATS} value={filter} onChange={setFilter} labels={labels} />
      </div>
      <div className={styles['news-list']} id="fullFeed">
        {list.length ? (
          list.map((n) => <NewsCard key={n.id} n={n} expandable />)
        ) : (
          <div className={styles.card}>
            <div className={styles.empty}>{t.terminal.headlines.empty}</div>
          </div>
        )}
      </div>
    </div>
  );
}
