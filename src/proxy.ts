/**
 * Next.js 16 network-boundary proxy (the renamed middleware.ts).
 *
 * Defense-in-depth only, exactly as AGENTS.md and the M2 Auth brief require:
 * this refreshes the Supabase session cookie and bounces a request with no
 * session at all to /login, before any route even starts rendering. It is
 * NOT the authorization boundary — that stays Postgres RLS and RPCs, plus
 * getViewer()'s own auth.uid()-derived resolution
 * (src/data/viewer-session.ts) for the finer invite states this coarse
 * check cannot see (not-invited, invite-expired, invalid-session details).
 * A bug here can, at worst, redirect someone who didn't need to be
 * redirected — it can never grant access RLS would otherwise deny.
 *
 * Skipped entirely when Supabase is not configured: synthetic/local mode
 * (M2 Auth brief item 7) has no session to refresh and no invite gate to
 * enforce.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isSupabaseConfigured } from '@/lib/backend';

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Re-checked, not just isSupabaseConfigured(): that call only proves the
  // env vars are non-empty strings at runtime, TypeScript cannot narrow
  // process.env from a separate function's return value.
  if (supabaseUrl === undefined || supabaseKey === undefined) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not run other code between createServerClient and getUser(): getUser()
  // is what actually revalidates/refreshes the session token against
  // Supabase, and anything relying on a stale read in between can produce
  // exactly the randomly-logged-out behavior this call exists to prevent.
  const { data, error } = await supabase.auth.getUser();

  if (error !== null || data.user === null) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!login|auth|dev|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
