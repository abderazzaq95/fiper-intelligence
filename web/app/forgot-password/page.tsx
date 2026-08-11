import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import styles from '@/components/auth/auth.module.css';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Reset Password — Fiper Intelligence',
};

export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/app');

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Image className={styles.logo} src="/logo.png" alt="Fiper" width={56} height={56} />
        {/* Heading/subtitle are rendered inside ForgotPasswordForm (a Client
            Component) so they can go through useLanguage() — this page stays
            a Server Component for the auth-redirect check above. */}
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
