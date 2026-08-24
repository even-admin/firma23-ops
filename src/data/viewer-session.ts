/**
 * Real viewer session resolution (M2 Auth).
 *
 * Replaces the prototype cookie as the thing every route asks for a viewer.
 * Without Supabase configured AND only when isSyntheticModeAllowed() also
 * confirms this is genuine local development, this delegates to the
 * prototype cookie unchanged — M1's local, no-backend workflow keeps
 * working exactly as before (see docs/M1-HANDOFF.md; item 7 of the M2 Auth
 * brief). A Preview or Production deployment missing its Supabase env vars
 * is a *different* case — backend-unavailable, never the synthetic viewer
 * (M2 Auth adversarial review, H1: this used to fail open to a founder).
 *
 * With Supabase configured, a viewer is never trusted from a cookie or
 * client claim. It is derived from auth.uid() and an *active* membership
 * row, both confirmed through redeem_invite()'s own return contract and an
 * RLS-scoped role lookup against the real database — the same authorization
 * Postgres itself enforces on every RPC and table, not a parallel decision
 * made in TypeScript. A membership that was linked and later revoked
 * returns its own 'revoked' state (H2) and never reaches { kind: 'viewer' }.
 * redeem_invite() is idempotent and cheap, so calling it here (not just
 * once at the auth callback) is what makes a stale "authenticated but not
 * yet linked" state self-heal on the very next page load, and what makes
 * "invite already redeemed" simply the normal path on every subsequent
 * request.
 *
 * Wrapped in React's cache() so layout.tsx and every page under it share one
 * resolution per request instead of one Supabase round trip each.
 */

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { isSupabaseConfigured, isSyntheticModeAllowed } from '@/lib/backend';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import type { ViewerContext, ViewerRole } from '@/lib/viewer';

export type ViewerSessionState =
  | { readonly kind: 'viewer'; readonly viewer: ViewerContext }
  | { readonly kind: 'anonymous' }
  | { readonly kind: 'not-invited' }
  | { readonly kind: 'invite-expired' }
  | { readonly kind: 'revoked' }
  | { readonly kind: 'invalid-session' }
  | { readonly kind: 'backend-unavailable' };

interface RedeemInviteRow {
  readonly state: 'redeemed' | 'invited' | 'expired' | 'unavailable' | 'revoked';
  readonly member_id: string | null;
  readonly org_id: string | null;
}

interface MemberRoleRow {
  readonly role: ViewerRole;
}

function isSessionMissingError(error: { readonly message?: string }): boolean {
  // Supabase's SDK reports "no session at all" as an error rather than a
  // null user with no error — this is what actually distinguishes a
  // never-signed-in visitor (anonymous) from a signed-in one whose session
  // Supabase can no longer validate (invalid-session), which gets its own
  // honest state below.
  return error.message?.toLowerCase().includes('auth session missing') === true;
}

/**
 * The uncached core resolver, exported separately so tests can call it
 * directly with mocked modules — react's cache() memoizes per render/request
 * scope, which does not exist in a plain test runner, and calling the cached
 * wrapper across multiple test cases would silently return the first test's
 * result to every test after it.
 */
export async function resolveViewerSessionStateUncached(): Promise<ViewerSessionState> {
  if (!isSupabaseConfigured()) {
    // H1: missing env vars must never be read as "grant the synthetic
    // founder viewer" — that is exactly what turned an anonymous visitor to
    // a misconfigured Preview/Production deployment into a founder.
    if (!isSyntheticModeAllowed()) {
      return { kind: 'backend-unavailable' };
    }
    return { kind: 'viewer', viewer: await getPrototypeViewer() };
  }

  try {
    const client = await createSupabaseServerClient();
    if (client === null) {
      return { kind: 'backend-unavailable' };
    }

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError !== null) {
      return isSessionMissingError(userError) ? { kind: 'anonymous' } : { kind: 'invalid-session' };
    }
    if (userData.user === null) {
      return { kind: 'anonymous' };
    }

    const redeemResult = await client.rpc('redeem_invite');
    if (redeemResult.error !== null) {
      return { kind: 'backend-unavailable' };
    }
    const redeemed = (redeemResult.data as readonly RedeemInviteRow[] | null)?.[0];
    if (redeemed === undefined) {
      return { kind: 'backend-unavailable' };
    }
    if (redeemed.state === 'unavailable') {
      return { kind: 'not-invited' };
    }
    if (redeemed.state === 'expired') {
      return { kind: 'invite-expired' };
    }
    if (redeemed.state === 'revoked') {
      // H2: auth_user_id was linked by a real past redemption, but the
      // membership behind it is no longer active. redeem_invite() itself
      // already refused to call this 'redeemed' and returned null ids —
      // there is nothing here to build a ViewerContext from, privileged or
      // otherwise.
      return { kind: 'revoked' };
    }

    // Only 'redeemed' or 'invited' reach here, and redeem_invite() now
    // guarantees both mean an active membership — confirmed by its own
    // active-membership join, not assumed from the state string alone.
    // member_id/org_id come straight from that result, never re-derived
    // from client input.
    const roleResult = await client
      .from('members')
      .select('role')
      .eq('id', redeemed.member_id as string)
      .single();
    if (roleResult.error !== null || roleResult.data === null) {
      return { kind: 'backend-unavailable' };
    }
    const roleRow = roleResult.data as MemberRoleRow;

    return {
      kind: 'viewer',
      viewer: {
        viewerId: redeemed.member_id as string,
        orgId: redeemed.org_id as string,
        role: roleRow.role,
      },
    };
  } catch {
    return { kind: 'backend-unavailable' };
  }
}

const cachedResolve = cache(resolveViewerSessionStateUncached);

/** The honest session state for the current request. */
export async function getViewerSessionState(): Promise<ViewerSessionState> {
  return cachedResolve();
}

/**
 * Drop-in replacement for getPrototypeViewer(): every route that used to
 * call that directly calls this instead, with the exact same call shape.
 * Always resolves to a real ViewerContext, or never returns — it redirects
 * to /login with the honest reason instead, so no call site needs to branch
 * on session state itself.
 */
export async function getViewer(): Promise<ViewerContext> {
  const state = await getViewerSessionState();
  if (state.kind === 'viewer') return state.viewer;
  redirect(`/login?state=${state.kind}`);
}
