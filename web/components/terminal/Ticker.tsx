'use client';

import styles from './terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { TRACKED, type CryptoQuote, type Quote } from '@/lib/terminal/marketData';
import { num, sign, cls, arrow } from '@/lib/terminal/format';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Ported from renderTicker(): the track is duplicated (html+html in the
   original) so `translateX(-50%)` produces a seamless scrolling loop. */
function TickItem({ q, dir }: { q: Quote | CryptoQuote; dir: 'ltr' | 'rtl' }) {
  return (
    <div className={styles.tick}>
      <span className={styles['tick-sym']}>{q.sym}</span>
      <span className={styles['tick-px']}>{num(q.price, q.price > 1000 ? 2 : q.price > 10 ? 2 : 4)}</span>
      <span className={`${styles['tick-chg']} ${styles[cls(q.chg)]}`}>
        {arrow(q.chg, dir)} {sign(q.chg)}%
      </span>
    </div>
  );
}

export function Ticker() {
  const S = useMarketData();
  const { dir } = useLanguage();
  const all: (Quote | CryptoQuote)[] = [...TRACKED.map((t) => S.quotes[t.sym]).filter(Boolean), ...Object.values(S.crypto)];

  return (
    <div className={styles.ticker}>
      <div className={styles['ticker-track']} id="tickTrack">
        {all.map((q, i) => (
          <TickItem key={`a${i}`} q={q} dir={dir} />
        ))}
        {all.map((q, i) => (
          <TickItem key={`b${i}`} q={q} dir={dir} />
        ))}
      </div>
    </div>
  );
}
