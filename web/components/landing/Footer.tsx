'use client';

import Image from 'next/image';
import styles from './landing.module.css';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  const footer = t.landing.footer;

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles['footer-top']}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Image className={styles['logo-mark']} src="/logo.png" alt="Fiper" width={38} height={38} />
              <span>
                <span className={styles['logo-word']}>Fiper</span>
                <span className={styles['logo-sub']}>Intelligence</span>
              </span>
            </div>
            <p className={styles['footer-tagline']}>{footer.tagline}</p>
            <div className={styles['footer-social']}>
              <a href="#" className={styles['social-btn']} aria-label="Instagram">IG</a>
              <a href="#" className={styles['social-btn']} aria-label="TikTok">TK</a>
              <a href="#" className={styles['social-btn']} aria-label="Discord">DC</a>
              <a href="#" className={styles['social-btn']} aria-label="Twitter/X">𝕏</a>
              <a href="#" className={styles['social-btn']} aria-label="LinkedIn">in</a>
              <a href="#" className={styles['social-btn']} aria-label="YouTube">▶</a>
            </div>
          </div>
          <div>
            <div className={styles['footer-col-title']}>{footer.platform}</div>
            <div className={styles['footer-links']}>
              {footer.platformLinks.map((link) => (
                <a href="#" key={link}>{link}</a>
              ))}
            </div>
          </div>
          <div>
            <div className={styles['footer-col-title']}>{footer.features}</div>
            <div className={styles['footer-links']}>
              {footer.featuresLinks.map((link) => (
                <a href="#" key={link}>{link}</a>
              ))}
            </div>
          </div>
          <div>
            <div className={styles['footer-col-title']}>{footer.markets}</div>
            <div className={styles['footer-links']}>
              {footer.marketsLinks.map((link) => (
                <a href="#" key={link}>{link}</a>
              ))}
            </div>
          </div>
        </div>
        <div className={styles['footer-bottom']}>
          <p className={styles['footer-copy']}>{footer.copyright(new Date().getFullYear())}</p>
          <p className={styles['footer-disclaimer']}>{footer.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
