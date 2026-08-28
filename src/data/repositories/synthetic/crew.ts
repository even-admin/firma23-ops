import { copy } from '@/copy/es-MX';
import type { CrewRepository } from '@/data/repositories/crew';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type { ReplaceOpportunityCrewInput, ReplaceOpportunityCrewResult } from '@/types/views';

export const syntheticCrewRepository: CrewRepository = {
  async replaceOpportunityCrew(
    _input: ReplaceOpportunityCrewInput,
    viewer: ViewerContext,
  ): Promise<ReplaceOpportunityCrewResult> {
    assertFounder(viewer, 'replaceOpportunityCrew');
    return { kind: 'unavailable', reason: copy.detail.crew.unavailable };
  },
};
