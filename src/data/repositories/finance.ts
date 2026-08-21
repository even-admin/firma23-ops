import type { ViewerContext } from '@/lib/viewer';
import type { FinanceOverview, SettlementPreview } from '@/types/views';

export interface FinanceRepository {
  /** Founder-only. */
  getOverview(viewer: ViewerContext): Promise<FinanceOverview>;
  /** Founder-only. Read-only in M1: no approval path exists. */
  getSettlementPreview(
    opportunityId: string,
    viewer: ViewerContext,
  ): Promise<SettlementPreview | null>;
}
