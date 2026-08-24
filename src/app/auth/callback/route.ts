import { NextResponse } from 'next/server';
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';

interface RedeemInviteRow {
  readonly state: 'redeemed' | 'invited' | 'expired' | 'unavailable';
}

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

function parseEmailOtpType(value: string | null): EmailOtpType | null {
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

/**
 * Runs redeem_invite() against the session just established and maps its
 * result to the honest next stop — the same mapping regardless of which
 * verification path got here.
 */
async function afterSessionEstablished(
  client: SupabaseClient,
  origin: string,
): Promise<NextResponse> {
  const redeemResult = await client.rpc('redeem_invite');
  if (redeemResult.error !== null) {
    return NextResponse.redirect(new URL('/login?state=backend-unavailable', origin));
  }
  const redeemed = (redeemResult.data as readonly RedeemInviteRow[] | null)?.[0];

  if (redeemed === undefined || redeemed.state === 'unavailable') {
    return NextResponse.redirect(new URL('/login?state=not-invited', origin));
  }
  if (redeemed.state === 'expired') {
    return NextResponse.redirect(new URL('/login?state=invite-expired', origin));
  }
  return NextResponse.redirect(new URL('/', origin));
}

/**
 * Magic-link callback: establishes the real session Supabase Auth just
 * verified, then immediately runs redeem_invite() — the post-login
 * invite-redemption boundary this product requires before an authenticated
 * session means anything (M2 Auth brief, item 3).
 *
 * Two verification paths are handled, not one:
 *
 * - `?code=` — exchangeCodeForSession. This is the path Supabase's default
 *   magic-link template + a PKCE-flow client (createServerClient from
 *   @supabase/ssr, our client) actually produce: confirmed end to end
 *   against the real project (session established, redeem_invite() ran,
 *   membership activated, home page loaded on a persisted session).
 * - `?token_hash=&type=` — verifyOtp. Supabase's own passwordless-email
 *   guide directs PKCE users to a custom template using this form instead
 *   ("If you're using PKCE flow, edit the Magic Link email template to send
 *   a token hash"). Handled as a second path, not a replacement for the
 *   first, as defense-in-depth against a future template change, a
 *   different email provider's link-scanning behavior, or a differently
 *   configured project — not because the first path was observed to fail.
 *
 * Never reads email or role from the URL or from client state: the only
 * inputs here are the opaque code/token, and every decision after that
 * comes from the session Supabase just established and the RPC's own
 * result.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const otpType = parseEmailOtpType(url.searchParams.get('type'));

  if (code === null && (tokenHash === null || otpType === null)) {
    return NextResponse.redirect(new URL('/login?state=invalid-session', url.origin));
  }

  const client = await createSupabaseServerClient();
  if (client === null) {
    return NextResponse.redirect(new URL('/login?state=backend-unavailable', url.origin));
  }

  if (code !== null) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error !== null) {
      return NextResponse.redirect(new URL('/login?state=invalid-session', url.origin));
    }
  } else {
    // tokenHash and otpType are both non-null here — checked above.
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash as string,
      type: otpType as EmailOtpType,
    });
    if (error !== null) {
      return NextResponse.redirect(new URL('/login?state=invalid-session', url.origin));
    }
  }

  return afterSessionEstablished(client, url.origin);
}
