'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Used inside AuthModal now (the standalone /login page was replaced by
   a redirect to / — see app/login/page.tsx). "Create account" switches
   the modal's tab instead of navigating; "Forgot your password?" still
   navigates for real, since /forgot-password remains its own page. */
export function LoginForm({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      // Supabase's error message is English-only — no reliable translation
      // mapping is exposed, so it passes through verbatim (see auth.ts).
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push('/app');
    router.refresh();
  }

  return (
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

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">{t.auth.password}</label>
        <input
          id="password"
          type="password"
          className={styles.input}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button type="submit" className={styles.button} disabled={loading}>
        {loading ? t.auth.signingIn : t.auth.signInButton}
      </button>

      <div className={styles.links}>
        <a href="/forgot-password" className={styles.link}>{t.auth.forgotPassword}</a>
        <button type="button" className={styles.link} onClick={onSwitchToRegister}>
          {t.auth.switchToRegister}
        </button>
      </div>
    </form>
  );
}
