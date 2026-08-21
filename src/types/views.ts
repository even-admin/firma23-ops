/**
 * View models.
 *
 * A shared contract between repositories and components. Repositories produce
 * these; components consume them as props. Keeping them here rather than inside
 * the data layer is what lets a presentational component stay honestly ignorant
 * of where its data came from.
 */

import type { Money } from '@/lib/money';
import type { MemberRole, OpportunityStatus, PayoutStatus } from '@/types/domain';

export interface MemberMoney {
  /** Settled by a founder. Real, owed or already paid. */
  readonly approved: Money;
  /** The part of approved money that has actually been paid out. */
  readonly paid: Money;
  /** Approved but still owed. */
  readonly approvedUnpaid: Money;
  /** Not earned, not payable, never ranked. Shown apart from everything above. */
  readonly projected: Money;
}

/** Per-row money keeps the same firewall the rail uses. */
export type AssignmentMoney =
  | { readonly kind: 'projected'; readonly amount: Money }
  | { readonly kind: 'approved'; readonly amount: Money; readonly payoutStatus: PayoutStatus };

export interface HomeAssignment {
  readonly opportunityId: string;
  readonly code: string;
  readonly beneficiaryName: string;
  readonly beneficiaryLocation: string;
  readonly projectName: string;
  readonly serviceName: string;
  readonly roleLabel: string;
  readonly status: OpportunityStatus;
  readonly active: boolean;
  readonly money: AssignmentMoney;
}

export interface NextAction {
  readonly key: string;
  readonly label: string;
  readonly detail: string;
  readonly tone: 'attention' | 'neutral';
}

export interface PersonalHome {
  readonly member: {
    readonly id: string;
    readonly displayName: string;
    readonly initials: string;
    readonly role: MemberRole;
  };
  readonly money: MemberMoney;
  readonly activeWorkCount: number;
  readonly assignments: readonly HomeAssignment[];
  readonly nextActions: readonly NextAction[];
}

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
