import type { ViewerContext } from '@/lib/viewer';
import type { OpportunityStatus } from '@/types/domain';
import type { OpportunityDetail } from '@/types/views';

export interface OpportunityQuery {
  readonly projectSlug?: string | undefined;
  readonly status?: OpportunityStatus | undefined;
}

export interface OpportunityRepository {
  getById(opportunityId: string, viewer: ViewerContext): Promise<OpportunityDetail | null>;
}
