import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

interface RedeemInviteRow {
  readonly state: 'redeemed' | 'invited' | 'expired' | 'unavailable';
}

/**
 * Magic-link callback: exchanges the one-time code Supabase Auth put in the
 * redirect URL for a real session, then immediately runs redeem_invite() —
 * the post-login invite-redemption boundary this product requires before an
 * authenticated session means anything (M2 Auth brief, item 3).
 *
 * Never reads email or role from the URL or from client state: the only
 * input here is the opaque code, and every decision after that comes from
 * the session Supabase just established and the RPC's own result.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code === null) {
    return NextResponse.redirect(new URL('/login?state=invalid-session', url.origin));
  }

  const client = await createSupabaseServerClient();
  if (client === null) {
    return NextResponse.redirect(new URL('/login?state=backend-unavailable', url.origin));
  }

  const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError !== null) {
    return NextResponse.redirect(new URL('/login?state=invalid-session', url.origin));
  }

  const redeemResult = await client.rpc('redeem_invite');
  if (redeemResult.error !== null) {
    return NextResponse.redirect(new URL('/login?state=backend-unavailable', url.origin));
  }
  const redeemed = (redeemResult.data as readonly RedeemInviteRow[] | null)?.[0];

  if (redeemed === undefined || redeemed.state === 'unavailable') {
    return NextResponse.redirect(new URL('/login?state=not-invited', url.origin));
  }
  if (redeemed.state === 'expired') {
    return NextResponse.redirect(new URL('/login?state=invite-expired', url.origin));
  }

  return NextResponse.redirect(new URL('/', url.origin));
}
