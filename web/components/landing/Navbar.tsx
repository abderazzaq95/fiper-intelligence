'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './landing.module.css';
import { useAuthModal } from '@/components/auth/AuthModalContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { open } = useAuthModal();
  const { t } = useLanguage();
  const nav = t.landing.navbar;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav id={styles.navbar} className={scrolled ? styles.scrolled : undefined}>
      <div className={styles.container}>
        <div className={styles['nav-inner']}>
          <a href="#" className={styles['nav-logo']}>
            <Image
              className={styles['logo-mark']}
              src="/logo.png"
              alt="Fiper"
              width={38}
              height={38}
            />
            <span>
              <span className={styles['logo-word']}>Fiper</span>
              <span className={styles['logo-sub']}>Intelligence</span>
            </span>
          </a>
          <ul className={styles['nav-links']}>
            <li><a href="#problem">{nav.features}</a></li>
            <li><a href="#how">{nav.howItWorks}</a></li>
            <li><a href="#">{nav.faq}</a></li>
            <li><a href="#">{nav.resources}</a></li>
          </ul>
          <div className={styles['nav-actions']}>
            <LanguageSwitcher />
            <button type="button" className={styles['nav-signin']} onClick={() => open('signin')}>{nav.signIn}</button>
            <button type="button" className={styles['btn-primary']} onClick={() => open('register')}>{nav.getAccess}</button>
          </div>
          <button
            className={styles.hamburger}
            aria-label="Open menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
      <div className={`${styles['mobile-menu']} ${menuOpen ? styles.open : ''}`}>
        <a href="#problem">{nav.features}</a>
        <a href="#how">{nav.howItWorks}</a>
        <a href="#">{nav.faq}</a>
        <a href="#">{nav.resources}</a>
        <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); open('signin'); }}>{nav.signIn}</a>
        <a
          href="#"
          style={{ color: 'var(--red-accent)', fontWeight: 700 }}
          onClick={(e) => { e.preventDefault(); setMenuOpen(false); open('register'); }}
        >
          {nav.getAccess} →
        </a>
        <div style={{ padding: '12px 24px 4px' }}>
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  );
}
