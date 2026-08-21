/**
 * Prototype viewers.
 *
 * A stand-in for the authenticated session until M2. Selecting a viewer here grants
 * nothing: it only shapes what the synthetic repositories choose to return, so the
 * founder and member products can both be reviewed locally.
 */

import type { ViewerContext } from '@/lib/viewer';

const FIRMA23_ORG_ID = 'a0000000-0000-4000-8000-000000000001';

export const PROTOTYPE_FOUNDER: ViewerContext = {
  viewerId: 'b0000000-0000-4000-8000-000000000001',
  orgId: FIRMA23_ORG_ID,
  role: 'founder',
};

export const PROTOTYPE_MEMBER: ViewerContext = {
  viewerId: 'b0000000-0000-4000-8000-000000000003',
  orgId: FIRMA23_ORG_ID,
  role: 'member',
};
