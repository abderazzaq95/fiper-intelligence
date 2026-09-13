import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { path: string[] } };

function isAllowed(path: string[]) {
  if (path.length === 1 && ['settings', 'kill', 'test-order'].includes(path[0])) return true;
  return path.length === 2 && path[0] === 'close' && path[1].length > 0;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  if (!isAllowed(params.path)) {
    return NextResponse.json({ ok: false, error: 'Unsupported trade action' }, { status: 404 });
  }

  const rawApiBase = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL;
  const apiBase = rawApiBase?.trim().replace(/\/+$/, '');
  const secret = process.env.TRADE_API_SECRET;

  if (!apiBase) {
    return NextResponse.json({ ok: false, error: 'Backend API URL is not configured on Vercel' }, { status: 500 });
  }
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'TRADE_API_SECRET is not configured on Vercel' }, { status: 500 });
  }

  const safePath = params.path.map(encodeURIComponent).join('/');
  try {
    const upstream = await fetch(`${apiBase}/api/trade/${safePath}`, {
      method: 'POST',
      headers: {
        'content-type': request.headers.get('content-type') || 'application/json',
        'x-trade-secret': secret,
      },
      body: await request.text(),
      cache: 'no-store',
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'backend request failed';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
