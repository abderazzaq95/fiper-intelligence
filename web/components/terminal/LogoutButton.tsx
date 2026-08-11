'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './terminal.module.css';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Repurposes the existing avatar circle (previously static "TR" initials,
   no interaction) as the sign-out trigger — same visual, same spot in the
   top-right cluster, now a real button. */
export function LogoutButton() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      className={styles.avatar}
      onClick={handleLogout}
      disabled={loading}
      aria-label={t.terminal.shell.signOut}
      title={t.terminal.shell.signOut}
    >
      TR
    </button>
  );
}
