import { copy } from '@/copy/es-MX';
import type { CrewRepository } from '@/data/repositories/crew';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type { ReplaceOpportunityCrewInput, ReplaceOpportunityCrewResult } from '@/types/views';

export const syntheticCrewRepository: CrewRepository = {
  async listOpportunityCrewReceipts(_opportunityId: string, viewer: ViewerContext) {
    assertFounder(viewer, 'listOpportunityCrewReceipts');
    return [];
  },

  async replaceOpportunityCrew(
    _input: ReplaceOpportunityCrewInput,
    viewer: ViewerContext,
  ): Promise<ReplaceOpportunityCrewResult> {
    assertFounder(viewer, 'replaceOpportunityCrew');
    return { kind: 'unavailable', reason: copy.detail.crew.unavailable };
  },
};
