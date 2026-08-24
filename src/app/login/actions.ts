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

async function resolveOrigin(): Promise<string> {
  // Never hardcoded: this is exactly what makes the same code correct on
  // localhost, a Vercel Preview URL, and Production without touching any of
  // them — the redirect target always matches the request that arrived.
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
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

  redirect(`/login?sent=${encodeURIComponent(email)}`);
}

export async function signOutAction(): Promise<void> {
  const client = await createSupabaseServerClient();
  if (client !== null) {
    await client.auth.signOut();
  }
  redirect('/login');
}
