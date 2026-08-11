import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/* Server-side Supabase client — used from Server Components (e.g. the
   login page's "already signed in?" check) and Route Handlers. Reads/
   writes auth cookies via next/headers. The setAll() call can throw when
   invoked from a Server Component (which can't set cookies) — that's
   fine to swallow here because the middleware is what actually refreshes
   the session on every request; this client only needs read access in
   that context. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — middleware handles session refresh instead
          }
        },
      },
    }
  );
}
