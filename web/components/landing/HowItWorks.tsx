'use client';

import styles from './landing.module.css';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const NUMS = ['01', '02', '03'];
const ICONS = ['🌐', '🤖', '🎯'];

export default function HowItWorks() {
  const { t } = useLanguage();
  const how = t.landing.howItWorks;

  return (
    <>
      <div className={styles['section-divider']}></div>
      <section id={styles.how}>
        <div className={styles.container}>
          <div className={`${styles['how-header']} ${styles.reveal}`}>
            <p className={styles['section-eyebrow']}>{how.eyebrow}</p>
            <h2 className={styles['section-title']}>{how.headline}</h2>
            <p className={`${styles['section-sub']} ${styles.muted}`}>{how.sub}</p>
          </div>

          <div className={styles['steps-grid']}>
            {how.steps.map((step, i) => (
              <div
                className={`${styles['step-card']} ${styles.reveal}`}
                style={i > 0 ? { transitionDelay: `${i * 0.1}s` } : undefined}
                key={NUMS[i]}
              >
                <div className={styles['step-num']}>{NUMS[i]}</div>
                <div className={styles['step-icon']}>{ICONS[i]}</div>
                <h3 className={styles['step-title']}>{step.title}</h3>
                <p className={styles['step-desc']}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
