'use client';

import styles from '../terminal.module.css';
import { useMarketData } from '@/lib/terminal/MarketDataProvider';
import { biasFor, bcls } from '@/lib/terminal/bias';
import { num, sign, cls, arrow } from '@/lib/terminal/format';
import { SourceBadge } from '../SourceBadge';
import { Gauge } from '../Gauge';
import { SparkLine } from '../SparkLine';
import { NewsCard } from '../NewsCard';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const HOME_ASSETS = ['NQUSD', 'XAUUSD', 'ESUSD', 'USOIL', 'BTCUSD', 'DXY'];

/* Ported from the #s-home section + renderRisk/renderBiasCards/renderNews/renderNextEvents. */
export function HomeScreen({ onGotoCalendar, onGotoBias }: { onGotoCalendar: () => void; onGotoBias: (sym: string) => void }) {
  const S = useMarketData();
  const { t, dir } = useLanguage();
  const upcoming = S.events.filter((e) => !e.released).slice(0, 4);
  const biasStamp = t.terminal.home.updated(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

  return (
    <div className={styles.split}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className={`${styles.grid} ${styles.g2}`}>
          <div className={styles.card}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>{t.terminal.home.riskEnvironment}</span>
              {/* The risk gauge is a derived model, not fetched — original hardcodes this badge as "Model" too. */}
              <span className={`${styles.src} ${styles.demo}`} id="srcRisk">{t.terminal.home.model}</span>
            </div>
            <Gauge value={S.risk} themes={S.themes} />
          </div>

          <div className={styles.card}>
            <div className={styles['card-head']}>
              <span className={styles['card-title']}>{t.terminal.home.nextReleases}</span>
              <button type="button" onClick={onGotoCalendar} className={styles['card-note']} style={{ marginInlineStart: 'auto' }}>
                {t.terminal.home.fullCalendar} →
              </button>
            </div>
            <div className={styles['card-body']} style={{ padding: '8px 0' }}>
              {upcoming.length ? (
                upcoming.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 16px', borderBottom: '1px solid var(--line)' }}>
                    <span className={styles.mono} style={{ fontSize: '.72rem', color: 'var(--muted)', width: 44 }}>{e.t}</span>
                    <span style={{ fontSize: '.66rem', fontWeight: 800, width: 30 }}>{e.ccy}</span>
                    <span style={{ fontSize: '.75rem', flex: 1 }}>{e.n}</span>
                    <span className={`${styles.pill} ${styles[e.imp.toLowerCase()]}`}>{t.common.impact[e.imp]}</span>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>{t.terminal.home.nothingLeftToday}</div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles['card-head']}>
            <span className={styles['card-title']}>{t.terminal.home.dailyBias}</span>
            <span className={styles['card-note']} id="biasStamp">{biasStamp}</span>
          </div>
          <div className={styles['card-body']}>
            <div className={`${styles.grid} ${styles.g3}`} id="biasCards">
              {HOME_ASSETS.map((sym) => {
                const q = S.quotes[sym] || S.crypto[sym];
                const b = biasFor(S, sym);
                if (!q || !b) return null;
                const col = q.chg > 0 ? '#00D084' : '#FF5470';
                const hist = q.hist || Array.from({ length: 24 }, (_, i) => q.price * (1 + Math.sin(i / 3) * 0.004));
                return (
                  <div className={styles['bias-card']} key={sym} onClick={() => onGotoBias(sym)}>
                    <div className={styles['bc-top']}>
                      <div>
                        <div className={styles['bc-sym']}>{sym}</div>
                        <div className={styles['bc-name']}>{q.name || sym}</div>
                      </div>
                      <span className={`${styles.pill} ${styles[bcls(b.dir)]}`}>{t.common.direction[b.dir]}</span>
                    </div>
                    <div className={styles['bc-px']}>{num(q.price, q.price > 1000 ? 2 : q.price > 10 ? 2 : 4)}</div>
                    <div className={`${styles['bc-chg']} ${styles[cls(q.chg)]}`}>{arrow(q.chg, dir)} {sign(q.chg)}%</div>
                    <div className={styles['bc-spark']}><SparkLine vals={hist} color={col} /></div>
                    <div className={styles['bc-foot']}>
                      <div className={styles['bc-mini']}>
                        <div className={styles['bc-mini-l']}>{t.terminal.home.swing}</div>
                        <div className={`${styles['bc-mini-v']} ${styles[b.swing.includes('Bull') ? 'up' : b.swing.includes('Bear') ? 'down' : 'flat']}`}>{t.common.direction[b.swing as keyof typeof t.common.direction]}</div>
                      </div>
                      <div className={styles['bc-mini']}>
                        <div className={styles['bc-mini-l']}>{t.terminal.home.day}</div>
                        <div className={`${styles['bc-mini-v']} ${styles[b.day.includes('Bull') ? 'up' : b.day.includes('Bear') ? 'down' : 'flat']}`}>{t.common.direction[b.day as keyof typeof t.common.direction]}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card} style={{ position: 'sticky', top: 0 }}>
        <div className={styles['card-head']}>
          <span className={styles['card-title']}>{t.terminal.home.liveFeed}</span>
          <SourceBadge mode={S.srcs.news} />
        </div>
        <div className={styles['card-body']} style={{ padding: 12, maxHeight: 'calc(100vh - 190px)', overflowY: 'auto' }}>
          <div className={styles['news-list']} id="homeFeed">
            {S.news.slice(0, 8).map((n) => (
              <NewsCard key={n.id} n={n} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
