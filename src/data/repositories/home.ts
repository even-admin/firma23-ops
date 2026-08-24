/**
 * Personal home contract.
 *
 * Unlike the founder finance surfaces, this is every member's own view, so it is
 * not founder-gated. It must return only the viewer's own money.
 *
 * Approved and projected are separate fields of separate shapes on purpose. A
 * consumer cannot add them together without noticing it is doing so.
 */

import type { ViewerContext } from '@/lib/viewer';
import type { PersonalHome } from '@/types/views';

export interface HomeRepository {
  getPersonalHome(viewer: ViewerContext): Promise<PersonalHome>;
}
