'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Used inside AuthModal now (the standalone /register page was replaced
   by a redirect to / — see app/register/page.tsx). "Sign in" switches
   the modal's tab instead of navigating.

   Whether this lands the user straight in /app or asks them to confirm
   their email first is decided by the Supabase dashboard's Authentication
   → Settings → "Enable email confirmations" toggle, not by this code —
   signUp() only returns an active session when that's off. Branching on
   `data.session` (rather than assuming one outcome) is what makes this
   correct either way: straight to /app when confirmations are off,
   a clear "check your email" message when they're on. */
export function RegisterForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);

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
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signUpError) {
      // Supabase's error message is English-only — no reliable translation
      // mapping is exposed, so it passes through verbatim (see auth.ts).
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      // email confirmations are off — the account is active immediately
      router.push('/app');
      router.refresh();
      return;
    }

    // email confirmations are on — no session yet, until they click the link
    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <div className={styles.success}>
        {t.auth.checkEmailToConfirm}
      </div>
    );
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
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="confirm">{t.auth.confirmPassword}</label>
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
        {loading ? t.auth.creatingAccount : t.auth.createAccountButton}
      </button>

      <div className={styles.links}>
        <button type="button" className={styles.link} onClick={onSwitchToSignIn}>
          {t.auth.switchToSignIn}
        </button>
      </div>
    </form>
  );
}
