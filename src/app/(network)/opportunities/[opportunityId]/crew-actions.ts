'use server';

import { activeCrewRepository } from '@/data/repositories/active/crew';
import { getViewer } from '@/data/viewer-session';
import type { ReplaceOpportunityCrewInput, ReplaceOpportunityCrewResult } from '@/types/views';

/**
 * Resolves the viewer itself rather than trusting one passed from the
 * client, matching every other founder-authority Server Action in this app
 * (see admin/intake-actions.ts and admin/members/actions.ts).
 */
export async function replaceOpportunityCrewAction(
  input: ReplaceOpportunityCrewInput,
): Promise<ReplaceOpportunityCrewResult> {
  const viewer = await getViewer();
  return activeCrewRepository.replaceOpportunityCrew(input, viewer);
}
