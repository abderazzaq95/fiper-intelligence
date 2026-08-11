import { redirect } from 'next/navigation';

/* Sign-in now lives in the auth modal on the landing page (see
   components/auth/AuthModal.tsx, triggered from Navbar/Hero). This route
   stays only so old links/bookmarks to /login don't 404. */
export default function LoginPage() {
  redirect('/');
}
