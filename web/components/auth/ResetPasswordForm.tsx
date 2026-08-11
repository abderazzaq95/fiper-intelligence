'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Landed on via the link Supabase emails from resetPasswordForEmail()
   (see ForgotPasswordForm's redirectTo). The browser client picks the
   recovery code out of the URL automatically (detectSessionInUrl is on
   by default) and fires a PASSWORD_RECOVERY auth event once that
   exchange finishes — this form just waits for that before allowing a
   submit, so a stale/invalid link fails clearly instead of silently. */
export function ResetPasswordForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // if the tab already processed the recovery link (e.g. fast reload),
    // a session may already be present — treat that as ready too.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t.auth.passwordsNoMatch);
      return;
    }
    if (password.length < 8) {
      setError(t.auth.passwordTooShort);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      // Supabase's error message is English-only — no reliable translation
      // mapping is exposed, so it passes through verbatim (see auth.ts).
      setError(updateError.message);
      return;
    }

    router.push('/app');
    router.refresh();
  }

  if (!ready) {
    return (
      <>
        <h1 className={styles.heading}>{t.auth.resetTitle}</h1>
        <div className={styles.subtitle}>
          {t.auth.verifyingLink}
          <a href="/forgot-password" className={styles.link}>{t.auth.requestNewOne}</a>.
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.heading}>{t.auth.resetTitle}</h1>
      <p className={styles.subtitle}>{t.auth.resetSubtitle}</p>
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">{t.auth.newPassword}</label>
          <input
            id="password"
            type="password"
            className={styles.input}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirm">{t.auth.confirmNewPassword}</label>
          <input
            id="confirm"
            type="password"
            className={styles.input}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? t.auth.updating : t.auth.updatePassword}
        </button>
      </form>
    </>
  );
}
