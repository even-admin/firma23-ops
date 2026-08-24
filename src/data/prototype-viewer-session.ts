/**
 * Reads the prototype viewer from a cookie.
 *
 * Server-only, and kept apart from the viewer constants so tests can import those
 * without pulling in next/headers.
 *
 * This is not a session and grants no permissions. See prototype-viewers.ts.
 */

import { cookies } from 'next/headers';

import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import type { ViewerContext, ViewerRole } from '@/lib/viewer';

export const PROTOTYPE_VIEWER_COOKIE = 'f23_prototype_viewer';

export async function getPrototypeViewer(): Promise<ViewerContext> {
  const store = await cookies();
  const role: ViewerRole =
    store.get(PROTOTYPE_VIEWER_COOKIE)?.value === 'member' ? 'member' : 'founder';
  return role === 'member' ? PROTOTYPE_MEMBER : PROTOTYPE_FOUNDER;
}
