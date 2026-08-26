import type { FinanceRepository } from '@/data/repositories/finance';
import { copy } from '@/copy/es-MX';
import { assertFounder } from '@/lib/viewer';
import { recordCashEvent, recordPayout } from '@/data/repositories/supabase/finance';
import {
  financeOverview,
  loadOperationalSnapshot,
  settlementPreview,
} from '@/data/repositories/supabase/operational-reads';

export const supabaseOperationalFinanceRepository: FinanceRepository = {
  async getOverview(viewer) {
    assertFounder(viewer, 'getFinanceOverview');
    return financeOverview(await loadOperationalSnapshot(viewer));
  },

  async getSettlementPreview(opportunityId, viewer) {
    assertFounder(viewer, 'getSettlementPreview');
    const preview = settlementPreview(await loadOperationalSnapshot(viewer), opportunityId);
    return preview === null
      ? null
      : { ...preview, approvalBlockedReason: copy.settle.blockedInM1 };
  },

  recordCashEvent,
  recordPayout,
};
