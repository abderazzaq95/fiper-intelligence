'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import styles from './authModal.module.css';
import { useAuthModal } from './AuthModalContext';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function AuthModal() {
  const { isOpen, tab, setTab, close } = useAuthModal();
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    // lock page scroll while the modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={close}>
      <div
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-heading"
      >
        <button className={styles.closeBtn} onClick={close} aria-label={t.auth.close}>
          ✕
        </button>

        <Image className={styles.logo} src="/logo.png" alt="Fiper" width={56} height={56} />
        <h2 id="auth-modal-heading" className={styles.heading}>{t.auth.modalTitle}</h2>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'signin' ? styles.tabActive : ''}`}
            onClick={() => setTab('signin')}
          >
            {t.auth.tabSignIn}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
            onClick={() => setTab('register')}
          >
            {t.auth.tabRegister}
          </button>
        </div>

        {tab === 'signin' ? (
          <LoginForm onSwitchToRegister={() => setTab('register')} />
        ) : (
          <RegisterForm onSwitchToSignIn={() => setTab('signin')} />
        )}
      </div>
    </div>
  );
}
