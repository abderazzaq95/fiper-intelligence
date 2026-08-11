'use client';

import styles from './landing.module.css';
import { useAuthModal } from '@/components/auth/AuthModalContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Hero() {
  const { open } = useAuthModal();
  const { t } = useLanguage();
  const hero = t.landing.hero;

  return (
    <section id={styles.hero}>
      <div className={styles['grid-bg']}></div>
      <div className={styles['hero-glow']}></div>
      <div className={styles['hero-glow-right']}></div>
      <div className={styles.container}>
        <div className={styles['hero-inner']}>

          <div className={`${styles['hero-left']} ${styles.reveal}`}>
            <div className={styles['hero-eyebrow']}>{hero.eyebrow}</div>
            <h1 className={styles['hero-headline']}>
              {hero.headlineStart}
              <em>{hero.headlineEm}</em>
            </h1>
            <p className={styles['hero-sub']}>
              {hero.sub}
            </p>
            <div className={styles['hero-ctas']}>
              <a href="#" className={styles['btn-primary']} onClick={(e) => { e.preventDefault(); open('register'); }}>{hero.getAccessNow} &nbsp;→</a>
              <a href="#how" className={styles['btn-ghost']}>{hero.seeHowItWorks}</a>
            </div>
            <div className={styles['hero-proof']}>
              <div className={styles['avatar-stack']}>
                <div className={styles['avatar-item']} style={{ background: 'rgba(210,43,43,0.2)' }}>JR</div>
                <div className={styles['avatar-item']} style={{ background: 'rgba(0,208,132,0.2)' }}>AS</div>
                <div className={styles['avatar-item']} style={{ background: 'rgba(210,43,43,0.2)' }}>MK</div>
                <div className={styles['avatar-item']} style={{ background: 'rgba(245,158,11,0.2)' }}>TD</div>
                <div className={styles['avatar-item']} style={{ background: 'rgba(255,59,92,0.2)' }}>LF</div>
              </div>
              <p className={styles['proof-text']}><strong>{hero.proofBold}</strong>{hero.proofRest}</p>
            </div>
          </div>

          <div className={`${styles['terminal-wrap']} ${styles.reveal}`} style={{ transitionDelay: '0.15s' }}>
            <video
              className={styles.terminal}
              src="/hero-terminal.mp4"
              autoPlay
              loop
              muted
              playsInline
              style={{ display: 'block', width: '100%', borderRadius: 14 }}
            />
          </div>

        </div>
      </div>
    </section>
  );
}
