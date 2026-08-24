/**
 * Settlement repository contract.
 *
 * This interface is what M2 must satisfy from Supabase. Nothing in it mentions
 * fixtures, JSON, or synthetic anything.
 */

import type { DistributableBase, RailModel } from '@/lib/allocation';
import type { Money } from '@/lib/money';
import type { ViewerContext } from '@/lib/viewer';
import type {
  ApproveSettlementInput,
  ApproveSettlementResult,
  OpportunitySummary,
  ReverseSettlementInput,
  ReverseSettlementResult,
} from '@/types/views';

export interface OpportunityRailCard {
  readonly opportunity: OpportunitySummary;
  /** Projection or approved settlement. Never both, never ambiguous. */
  readonly rail: RailModel;
  readonly distributableBase: DistributableBase;
  readonly cashReceived: Money;
}

export interface SettlementRepository {
  /** Founder-only. Members reach their own lines through a separate method in S3. */
  listOpportunityRails(viewer: ViewerContext): Promise<OpportunityRailCard[]>;
  getOpportunityRail(
    opportunityId: string,
    viewer: ViewerContext,
  ): Promise<OpportunityRailCard | null>;
  /**
   * Founder-only. Derives and approves a settlement from the opportunity's
   * own snapshotted rule, cash events, and assignments — the caller submits
   * no money figure. The synthetic/local adapter has no write path at all
   * and always answers `unavailable`.
   */
  approveSettlement(
    input: ApproveSettlementInput,
    viewer: ViewerContext,
  ): Promise<ApproveSettlementResult>;
  /**
   * Founder-only. Creates the exact signed reversal of an approved
   * original. The synthetic/local adapter has no write path at all and
   * always answers `unavailable`.
   */
  reverseSettlement(
    input: ReverseSettlementInput,
    viewer: ViewerContext,
  ): Promise<ReverseSettlementResult>;
}
