/**
 * Reads the prototype viewer from a cookie.
 *
 * Server-only, and kept apart from the viewer constants so tests can import those
 * without pulling in next/headers.
 *
 * Never reached outside genuine local development or a plain test run once
 * Supabase is configured or the app is deployed anywhere — see
 * isSyntheticModeAllowed() in src/lib/backend.ts, which every caller of this
 * function must check first (M2 Auth adversarial review, H1). Within that
 * boundary, this grants no *Postgres* authority — RLS and every RPC still
 * derive the real actor from auth.uid(), never from this cookie — but it
 * does pick which synthetic UI a local developer sees, so the default below
 * matters: least privilege first. Only an explicit 'founder' cookie value
 * (set by the ViewerSwitcher control) elevates it; anything else, including
 * no cookie at all or an unrecognized value, is 'member'.
 */

import { cookies } from 'next/headers';

import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import type { ViewerContext, ViewerRole } from '@/lib/viewer';

export const PROTOTYPE_VIEWER_COOKIE = 'f23_prototype_viewer';

export async function getPrototypeViewer(): Promise<ViewerContext> {
  const store = await cookies();
  const role: ViewerRole =
    store.get(PROTOTYPE_VIEWER_COOKIE)?.value === 'founder' ? 'founder' : 'member';
  return role === 'founder' ? PROTOTYPE_FOUNDER : PROTOTYPE_MEMBER;
}
