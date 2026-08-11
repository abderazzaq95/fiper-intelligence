import { redirect } from 'next/navigation';

/* Registration now lives in the auth modal on the landing page (see
   components/auth/AuthModal.tsx, triggered from Navbar/Hero). This route
   stays only so old links/bookmarks to /register don't 404. */
export default function RegisterPage() {
  redirect('/');
}
