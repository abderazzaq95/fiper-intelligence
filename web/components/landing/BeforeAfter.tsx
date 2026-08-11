'use client';

import styles from './landing.module.css';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function BeforeAfter() {
  const { t } = useLanguage();
  const ba = t.landing.beforeAfter;

  return (
    <>
      <div className={styles['section-divider']}></div>
      <section id={styles['before-after']}>
        <div className={styles.container}>
          <div className={`${styles['ba-header']} ${styles.reveal}`}>
            <p className={styles['section-eyebrow']}>{ba.eyebrow}</p>
            <h2 className={styles['section-title']}>{ba.headline}</h2>
            <p className={styles['section-sub']}>{ba.sub}</p>
          </div>

          <div className={`${styles['ba-panels']} ${styles.reveal}`}>
            <div className={`${styles['ba-panel']} ${styles.before} ${styles.glass}`}>
              <div className={styles['ba-panel-label']}>{ba.beforeLabel}</div>
              <div className={styles['ba-panel-body']}>
                <div className={`${styles['raw-row']} ${styles.header}`}>
                  <span>{ba.tableHeaders.time}</span><span>{ba.tableHeaders.event}</span><span>{ba.tableHeaders.prev}</span><span>{ba.tableHeaders.fore}</span>
                </div>
                <div className={styles['raw-row']}><span className={styles.mono}>08:30</span><span>CPI m/m</span><span>0.3%</span><span>0.2%</span></div>
                <div className={styles['raw-row']}><span className={styles.mono}>10:00</span><span>ISM Mfg</span><span>49.3</span><span>48.5</span></div>
                <div className={styles['raw-row']}><span className={styles.mono}>14:00</span><span>FOMC Min</span><span>—</span><span>—</span></div>
                <div className={styles['raw-row']}><span className={styles.mono}>14:30</span><span>Powell Spk</span><span>—</span><span>—</span></div>
                <div className={styles['raw-row']}><span className={styles.mono}>20:00</span><span>EIA Oil</span><span>-3.2M</span><span>-1.5M</span></div>
                <div style={{ padding: '16px 0 0', textAlign: 'center', color: 'var(--muted2)', fontSize: '0.78rem' }}>
                  {ba.zeroContext}
                </div>
              </div>
            </div>

            <div className={`${styles['ba-panel']} ${styles.after} ${styles.glass}`}>
              <div className={styles['ba-panel-label']}>{ba.afterLabel}</div>
              <div className={styles['ba-panel-body']}>
                <div className={styles['pb-event']}>
                  <div className={styles['pb-event-top']}>
                    <span className={styles['pb-event-name']}>{ba.event1Name}</span>
                    <span className={`${styles['pb-bias']} ${styles.bear}`}>{ba.event1Bias}</span>
                  </div>
                  <p className={styles['pb-context']}>{ba.event1Context}</p>
                  <div className={styles['pb-assets']}>
                    <span className={`${styles['nc-asset']} ${styles.down}`}>USD ↑</span>
                    <span className={`${styles['nc-asset']} ${styles.down}`}>XAUUSD ↓</span>
                    <span className={`${styles['nc-asset']} ${styles.up}`}>DXY ↑</span>
                  </div>
                </div>
                <div className={styles['pb-event']}>
                  <div className={styles['pb-event-top']}>
                    <span className={styles['pb-event-name']}>{ba.event2Name}</span>
                    <span className={`${styles['pb-bias']} ${styles.bull}`}>{ba.event2Bias}</span>
                  </div>
                  <p className={styles['pb-context']}>{ba.event2Context}</p>
                  <div className={styles['pb-assets']}>
                    <span className={`${styles['nc-asset']} ${styles.up}`}>NQUSD ↑</span>
                    <span className={`${styles['nc-asset']} ${styles.up}`}>ESUSD ↑</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
