'use client';

import styles from './landing.module.css';
import { newsItems } from './data/news-items';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Problem() {
  const { t } = useLanguage();
  const doubled = [...newsItems, ...newsItems];

  return (
    <section id={styles.problem}>
      <div className={styles.container}>
        <div className={styles['problem-inner']}>

          <div className={styles.reveal}>
            <p className={styles['section-eyebrow']}>{t.landing.problem.eyebrow}</p>
            <h2 className={styles['section-title']}>{t.landing.problem.headline1}<br />{t.landing.problem.headline2}</h2>
            <p className={styles['section-sub']}>
              {t.landing.problem.sub}
            </p>
            <a href="#" className={styles['btn-primary']}>{t.landing.problem.cta} &nbsp;→</a>
          </div>

          <div className={`${styles['news-feed-wrap']} ${styles.reveal}`} style={{ transitionDelay: '0.1s' }}>
            <div className={styles['news-feed-track']}>
              {doubled.map((item, i) => (
                <div className={styles['news-card']} key={i}>
                  <div className={styles['nc-top']}>
                    <span className={styles['nc-impact']}>{item.impact}</span>
                    <span className={`${styles['nc-time']} ${styles.mono}`}>{item.time}</span>
                  </div>
                  <div className={styles['nc-headline']}>{item.headline}</div>
                  <div className={styles['nc-summary']}>{item.summary}</div>
                  <div className={styles['nc-assets']}>
                    {item.assets.map((a, j) => (
                      <span className={`${styles['nc-asset']} ${styles[a.dir]}`} key={j}>{a.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
