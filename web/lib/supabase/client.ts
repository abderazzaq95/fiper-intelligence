import { createBrowserClient } from '@supabase/ssr';

/* Browser-side Supabase client — used from Client Components (the login
   form, forgot-password form, reset-password form, logout button). Reads
   the two public env vars; safe to expose since the anon key is scoped by
   Row Level Security on the Supabase project, not a secret. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
