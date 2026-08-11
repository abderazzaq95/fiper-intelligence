'use client';

import { useState, type FormEvent } from 'react';
import styles from './auth.module.css';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function ForgotPasswordForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);

    if (resetError) {
      // Supabase's error message is English-only — no reliable translation
      // mapping is exposed, so it passes through verbatim (see auth.ts).
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <>
        <h1 className={styles.heading}>{t.auth.forgotTitle}</h1>
        <div className={styles.success}>
          {t.auth.resetLinkSent}
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.heading}>{t.auth.forgotTitle}</h1>
      <p className={styles.subtitle}>{t.auth.forgotSubtitle}</p>
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">{t.auth.email}</label>
          <input
            id="email"
            type="email"
            className={styles.input}
            placeholder={t.auth.emailPlaceholder}
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? t.auth.sending : t.auth.sendResetLink}
        </button>

        <div className={styles.links}>
          <a href="/login" className={styles.link}>{t.auth.backToSignIn}</a>
        </div>
      </form>
    </>
  );
}
