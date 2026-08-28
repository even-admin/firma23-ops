import type { ViewerContext } from '@/lib/viewer';
import type { ReplaceOpportunityCrewInput, ReplaceOpportunityCrewResult } from '@/types/views';

export interface CrewRepository {
  replaceOpportunityCrew(
    input: ReplaceOpportunityCrewInput,
    viewer: ViewerContext,
  ): Promise<ReplaceOpportunityCrewResult>;
}
