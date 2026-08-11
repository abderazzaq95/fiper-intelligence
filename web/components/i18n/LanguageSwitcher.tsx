'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './LanguageSwitcher.module.css';

/* EN | AR toggle — one component, used in both the landing Navbar and the
   terminal TopBar. Deliberately plain CSS (not the terminal's CSS-var
   token system or the landing's) so it renders identically and correctly
   in both contexts regardless of which module.css scope it's mounted
   inside. */
export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className={styles.switcher} role="group" aria-label="Language">
      <button
        type="button"
        className={`${styles.option} ${lang === 'en' ? styles.active : ''}`}
        onClick={() => setLang('en')}
      >
        EN
      </button>
      <span className={styles.divider} />
      <button
        type="button"
        className={`${styles.option} ${lang === 'ar' ? styles.active : ''}`}
        onClick={() => setLang('ar')}
      >
        AR
      </button>
    </div>
  );
}
