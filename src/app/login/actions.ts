'use server';

/**
 * Login Server Actions.
 *
 * Every branch below either sends a magic link through Supabase's own Auth
 * API or ends the request with a redirect — nothing here grants access.
 * Authorization is decided later, by redeem_invite() and RLS, when the
 * session this creates is actually used (src/data/viewer-session.ts).
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Hosts this deployment is actually allowed to redirect a magic link back
 * to. `x-forwarded-host`/`host` come from the request and must never be
 * trusted blindly — a forged Host header could otherwise make Supabase
 * email a link back to an attacker-controlled origin. VERCEL_URL is set by
 * Vercel to *this exact deployment's own* canonical URL (a fresh, unique
 * one per Preview deployment), so allowlisting it — rather than a wildcard
 * pattern — self-adapts per environment without trusting anything the
 * request claims about itself.
 */
function allowedHosts(): ReadonlySet<string> {
  const hosts = new Set(['localhost:3000', '127.0.0.1:3000']);
  if (process.env.VERCEL_URL !== undefined) hosts.add(process.env.VERCEL_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL !== undefined) {
    hosts.add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  return hosts;
}

/**
 * Exported only so tests can call it directly with mocked headers/env — the
 * "use server" directive on this file requires every export to be an async
 * function, which this already is.
 */
export async function resolveOrigin(): Promise<string> {
  const headerList = await headers();
  const requestedHost = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const requestedProto = headerList.get('x-forwarded-proto');
  // M3: strictly http or https, nothing else — the host allowlist above
  // guards which origin this can become, but nothing previously guarded the
  // scheme, so a permitted host paired with any other x-forwarded-proto
  // value used to pass through unchecked.
  const proto = requestedProto === 'http' || requestedProto === 'https' ? requestedProto : null;

  if (requestedHost !== null && proto !== null && allowedHosts().has(requestedHost)) {
    return `${proto}://${requestedHost}`;
  }

  // Host wasn't recognized, or the protocol wasn't exactly http/https:
  // never trust either partially. Prefer the deployment's own known-good
  // production URL; only local dev has neither Vercel env var set, which is
  // exactly when localhost is the correct default.
  const fallbackHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'localhost:3000';
  const fallbackProto = fallbackHost === 'localhost:3000' ? 'http' : 'https';
  return `${fallbackProto}://${fallbackHost}`;
}

export async function sendMagicLinkAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  if (email === '') {
    redirect('/login?state=invalid-email');
  }

  const client = await createSupabaseServerClient();
  if (client === null) {
    redirect('/login?state=backend-unavailable');
  }

  const origin = await resolveOrigin();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error !== null) {
    redirect('/login?state=send-error');
  }

  // No email in the redirect: query strings land in server access logs,
  // browser history, and Referer headers. "sent" alone is enough for the
  // honest confirmation copy.
  redirect('/login?sent=1');
}

export async function signOutAction(): Promise<void> {
  const client = await createSupabaseServerClient();
  if (client !== null) {
    await client.auth.signOut();
  }
  redirect('/login');
}
