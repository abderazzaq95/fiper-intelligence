'use client';

import styles from './landing.module.css';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Compare() {
  const { t } = useLanguage();
  const cmp = t.landing.compare;

  return (
    <>
      <div className={styles['section-divider']}></div>
      <section id={styles.compare}>
        <div className={styles.container}>
          <div className={`${styles['compare-header']} ${styles.reveal}`}>
            <p className={styles['section-eyebrow']}>{cmp.eyebrow}</p>
            <h2 className={styles['section-title']}>{cmp.headline1}<br />{cmp.headline2}</h2>
            <p className={`${styles['section-sub']} ${styles.muted}`}>{cmp.sub}</p>
          </div>

          <div className={`${styles['compare-grid']} ${styles.reveal}`}>
            <div className={`${styles['compare-col']} ${styles.signals}`}>
              <h3 className={styles['compare-col-title']}>{cmp.signalsTitle}</h3>
              <p className={styles['compare-col-sub']}>{cmp.signalsSub}</p>
              <div className={styles['compare-items']}>
                {cmp.signalItems.map((text) => (
                  <div className={`${styles['compare-item']} ${styles.bad}`} key={text}>
                    <span className={styles['ci-icon']}>✗</span> {text}
                  </div>
                ))}
              </div>
            </div>
            <div className={`${styles['compare-col']} ${styles.ours}`}>
              <span className={styles['compare-badge']}>{cmp.recommended}</span>
              <h3 className={styles['compare-col-title']} style={{ color: 'var(--red-accent)' }}>{cmp.oursTitle}</h3>
              <p className={styles['compare-col-sub']}>{cmp.oursSub}</p>
              <div className={styles['compare-items']}>
                {cmp.ourItems.map((text) => (
                  <div className={`${styles['compare-item']} ${styles.good}`} key={text}>
                    <span className={styles['ci-icon']} style={{ color: 'var(--green)' }}>✓</span> {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
