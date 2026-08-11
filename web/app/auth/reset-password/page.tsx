import type { Metadata } from 'next';
import Image from 'next/image';
import styles from '@/components/auth/auth.module.css';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Set New Password — Fiper Intelligence',
};

/* Not in the original page list — added because /forgot-password's reset
   link has to land somewhere that lets the user actually set a new
   password; without this the "forgot password" flow sends an email that
   goes nowhere. Same styling system as /login and /forgot-password. */
export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Image className={styles.logo} src="/logo.png" alt="Fiper" width={56} height={56} />
        {/* Heading/subtitle are rendered inside ResetPasswordForm (a Client
            Component) so they can go through useLanguage() — this page stays
            a Server Component (metadata export requires it). */}
        <ResetPasswordForm />
      </div>
    </div>
  );
}
