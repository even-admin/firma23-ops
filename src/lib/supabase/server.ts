/**
 * Server-side Supabase client for Next.js Server Components/Actions.
 *
 * Uses the publishable (anon) key plus the request's own auth cookies, never
 * a service-role key — RLS on every table is what actually authorizes a
 * query, exactly as AGENTS.md requires ("Founder permissions and operator
 * permissions must be enforced in Postgres RLS, not only in UI code").
 *
 * Only src/data/repositories/supabase/** and the confirm/discard server
 * actions may import this. Returns null when Supabase is not configured so
 * every caller has one honest branch to take instead of throwing deep inside
 * a request.
 */

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { isSupabaseConfigured } from '@/lib/backend';

export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url === undefined || publishableKey === undefined) return null;

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, which cannot set cookies.
          // Session refresh in that context is handled by middleware in a
          // real deployment; a read-only repository call has nothing to
          // write anyway, so there is nothing lost by ignoring this here.
        }
      },
    },
  });
}
