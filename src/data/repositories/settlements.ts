/**
 * Settlement repository contract.
 *
 * This interface is what M2 must satisfy from Supabase. Nothing in it mentions
 * fixtures, JSON, or synthetic anything.
 */

import type { DistributableBase, RailModel } from '@/lib/allocation';
import type { Money } from '@/lib/money';
import type { ViewerContext } from '@/lib/viewer';
import type { OpportunityStatus } from '@/types/domain';

export interface OpportunitySummary {
  readonly id: string;
  readonly code: string;
  readonly beneficiaryName: string;
  readonly beneficiaryLocation: string;
  readonly status: OpportunityStatus;
  readonly projectName: string;
  readonly projectSlug: string;
  readonly serviceName: string;
  readonly serviceVersion: number;
  readonly openedAt: string;
}

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
}
