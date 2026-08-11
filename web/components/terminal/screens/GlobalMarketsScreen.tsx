'use client';

import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { TRACKED, type CryptoQuote, type Quote } from '@/lib/terminal/marketData';
import { biasFor, bcls } from '@/lib/terminal/bias';
import { num, sign, cls, arrow } from '@/lib/terminal/format';
import { HeatCell } from '../HeatCell';
import { SparkLine } from '../SparkLine';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Ported from #s-global + renderGlobal(). */
export function GlobalMarketsScreen() {
  const S = useMarketData();
  const { t, dir } = useLanguage();
  const all: (Quote | CryptoQuote)[] = [...TRACKED.map((tr) => S.quotes[tr.sym]).filter(Boolean), ...Object.values(S.crypto)];

  return (
    <div>
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{t.terminal.global.heatMap}</span>
          <span className={styles['card-note']}>{t.terminal.global.change24h}</span>
        </div>
        <div className={styles['card-body']}>
          <div className={styles.heat} id="heatMap">
            {all.map((q, i) => <HeatCell key={i} sym={q.sym} price={q.price} chg={q.chg} />)}
          </div>
        </div>
      </div>
      <div className={`${styles.grid} ${styles.g4}`} id="marketCards">
        {all.map((q, i) => {
          const b = biasFor(S, q.sym);
          const col = q.chg > 0 ? '#00D084' : '#FF5470';
          const hist = q.hist || Array.from({ length: 24 }, (_, j) => q.price * (1 + Math.sin(j / 3) * 0.005));
          return (
            <div className={styles.card} key={i}>
              <div className={styles['card-body']}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div className={styles['bc-sym']}>{q.sym}</div>
                    <div className={styles['bc-name']}>{q.name || t.terminal.global.crypto}</div>
                  </div>
                  {b && <span className={`${styles.pill} ${styles[bcls(b.dir)]}`}>{t.common.direction[b.dir]}</span>}
                </div>
                <div className={styles['bc-px']}>{num(q.price, q.price > 1000 ? 2 : q.price > 10 ? 2 : 4)}</div>
                <div className={`${styles['bc-chg']} ${styles[cls(q.chg)]}`}>{arrow(q.chg, dir)} {sign(q.chg)}%</div>
                <div style={{ marginTop: 8 }}><SparkLine vals={hist} color={col} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
