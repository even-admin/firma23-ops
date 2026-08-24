import type { ViewerContext } from '@/lib/viewer';
import type {
  FinanceOverview,
  RecordCashEventInput,
  RecordCashEventResult,
  RecordPayoutInput,
  RecordPayoutResult,
  SettlementPreview,
} from '@/types/views';

export interface FinanceRepository {
  /** Founder-only. */
  getOverview(viewer: ViewerContext): Promise<FinanceOverview>;
  /** Founder-only. Read-only in M1: no approval path exists. */
  getSettlementPreview(
    opportunityId: string,
    viewer: ViewerContext,
  ): Promise<SettlementPreview | null>;
  /**
   * Founder-only. The only door onto the cash ledger; can never create a
   * payout event (record_payout is the only door for those). The
   * synthetic/local adapter has no write path at all and always answers
   * `unavailable`.
   */
  recordCashEvent(
    input: RecordCashEventInput,
    viewer: ViewerContext,
  ): Promise<RecordCashEventResult>;
  /**
   * Founder-only. Atomically creates a payout event and its allocations, or
   * reallocates against a historical payout event for reverse-and-reissue.
   * The synthetic/local adapter has no write path at all and always
   * answers `unavailable`.
   */
  recordPayout(input: RecordPayoutInput, viewer: ViewerContext): Promise<RecordPayoutResult>;
}
