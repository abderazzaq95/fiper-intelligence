'use client';

import styles from './landing.module.css';
import { testimonials } from './data/testimonials';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Testimonials() {
  const { t } = useLanguage();
  const doubled = [...testimonials, ...testimonials];

  return (
    <>
      <div className={styles['section-divider']}></div>
      <section id={styles.testimonials}>
        <div className={styles.container}>
          <div className={`${styles['test-header']} ${styles.reveal}`}>
            <p className={styles['section-eyebrow']}>{t.landing.testimonials.eyebrow}</p>
            <h2 className={styles['section-title']}>{t.landing.testimonials.headline}</h2>
          </div>
        </div>
        <div className={styles['test-track-wrap']}>
          <div className={styles['test-track']}>
            {doubled.map((t, i) => (
              <div className={`${styles['test-card']} ${styles.glass}`} key={i}>
                <div className={styles['test-handle']}>{t.handle}</div>
                <p className={styles['test-quote']}>&quot;{t.quote}&quot;</p>
                <div className={styles['test-stars']}>{t.stars}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
