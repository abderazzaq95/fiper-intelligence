'use client';

import styles from './terminal.module.css';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Logo extracted to /public/logo.png (was inline base64 in the original
   .brand img). Plain <img> rather than next/image — matches the original
   30x30 rendered size and drop-shadow filter without next/image's layout
   fitting getting in the way.

   Brand wordmark ("Fiper"/"Intelligence") is kept as the Latin-script
   wordmark in BOTH languages — common real-world practice for brand marks
   (e.g. "Google" stays "Google" in Arabic Google), so it is intentionally
   NOT run through t.terminal.shell.fiper/.intelligence even though Arabic
   transliterations exist in the dictionary. Only the "Menu" aria-label
   (genuine UI copy, not a brand mark) is translated. */
export function Brand({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { t } = useLanguage();
  return (
    <div className={styles.brand}>
      <button
        className={`${styles['icon-btn']} ${styles['mob-toggle']}`}
        id="mobBtn"
        aria-label={t.terminal.shell.menu}
        onClick={onToggleSidebar}
        type="button"
      >
        ☰
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Fiper" width={30} height={30} />
      <div>
        <span className={styles['brand-name']}>Fiper</span>
        <span className={styles['brand-sub']}>Intelligence</span>
      </div>
    </div>
  );
}
