import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Every /app/* route (the terminal) requires a session. Landing (/),
  // /login, /forgot-password, and /auth/* stay unauthenticated.
  matcher: ['/app/:path*'],
};
