import type { ViewerContext } from '@/lib/viewer';
import type {
  CrewChangeReceiptView,
  ReplaceOpportunityCrewInput,
  ReplaceOpportunityCrewResult,
} from '@/types/views';

export interface CrewRepository {
  listOpportunityCrewReceipts(
    opportunityId: string,
    viewer: ViewerContext,
  ): Promise<readonly CrewChangeReceiptView[]>;

  replaceOpportunityCrew(
    input: ReplaceOpportunityCrewInput,
    viewer: ViewerContext,
  ): Promise<ReplaceOpportunityCrewResult>;
}
