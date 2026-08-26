import type { OpportunityRepository } from '@/data/repositories/opportunities';
import { loadOperationalSnapshot, opportunityDetail } from '@/data/repositories/supabase/operational-reads';
import { assertFounder } from '@/lib/viewer';

export const supabaseOpportunityRepository: OpportunityRepository = {
  async getById(opportunityId, viewer) {
    assertFounder(viewer, 'getOpportunityDetail');
    return opportunityDetail(await loadOperationalSnapshot(viewer), opportunityId);
  },
};
