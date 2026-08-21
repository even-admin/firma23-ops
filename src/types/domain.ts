/**
 * Domain entities for the M1 read surface.
 *
 * These mirror the tables in docs/ARCHITECTURE.md. They are deliberately shaped as
 * the application wants to consume them, not as JSON happens to be stored, so that
 * M2 can satisfy the same types from Postgres rows.
 *
 * Nothing project-specific belongs here. SETY's percentages, base policy, and
 * service catalogue live in versioned fixture data, never in a type or a constant.
 */

import type { BasisPoints, CurrencyCode, Money } from '@/lib/money';

export interface Organization {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

export type MemberRole = 'founder' | 'member';

export interface Member {
  /** Stable identity. Display names are never identity. */
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly initials: string;
  readonly role: MemberRole;
  readonly orgId: string;
}

export type ProjectStatus = 'draft' | 'active' | 'closed';

export interface Project {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly sponsorName: string;
  readonly status: ProjectStatus;
  readonly currency: CurrencyCode;
  readonly activeAllocationRuleVersionId: string | null;
}

export interface ServiceVersion {
  readonly id: string;
  readonly projectId: string;
  readonly key: string;
  readonly name: string;
  readonly version: number;
  readonly deliverablesSummary: string;
  /** Service versions used by an opportunity are frozen. Invariant 3. */
  readonly immutable: true;
}

export type OpportunityStatus =
  'draft' | 'assigned' | 'in_delivery' | 'delivered' | 'settled_approved' | 'paid' | 'cancelled';

export interface Opportunity {
  readonly id: string;
  readonly projectId: string;
  /** Snapshotted at creation. Invariant 3. */
  readonly serviceVersionId: string;
  /** Snapshotted at creation. Invariant 3. */
  readonly allocationRuleVersionId: string;
  readonly code: string;
  readonly beneficiaryName: string;
  readonly beneficiaryLocation: string;
  readonly status: OpportunityStatus;
  readonly openedAt: string;
}

export type AssignmentRoleKey = 'closer' | 'delivery';
export type AssignmentStatus = 'proposed' | 'approved';

export interface Assignment {
  readonly id: string;
  readonly opportunityId: string;
  readonly memberId: string;
  readonly roleKey: AssignmentRoleKey;
  readonly roleLabel: string;
  /** Weight inside this role's pool. Delivery weights must total 10,000. Invariant 6. */
  readonly weightBp: BasisPoints;
  readonly status: AssignmentStatus;
}

export type CashEventType =
  'invoice' | 'withholding' | 'deposit' | 'contribution' | 'adjustment' | 'payout';

export interface CashEvent {
  readonly id: string;
  readonly opportunityId: string;
  readonly type: CashEventType;
  readonly label: string;
  readonly amount: Money;
  readonly occurredAt: string;
}

/**
 * Which cash events form the distributable base, expressed as data.
 *
 * SETY includes only the sponsor deposit, which is why the beneficiary
 * contribution is excluded. That is this record's content, not a rule in code.
 */
export interface BasePolicy {
  readonly kind: 'cash_event_types';
  readonly includeTypes: readonly CashEventType[];
  readonly label: string;
  readonly note: string;
}

export type AllocationRecipientKind = 'house' | 'closer' | 'delivery_pool';

export interface AllocationShare {
  readonly key: string;
  readonly kind: AllocationRecipientKind;
  readonly label: string;
  readonly weightBp: BasisPoints;
  readonly recipientOrgId: string | null;
}

export interface AllocationRuleVersion {
  readonly id: string;
  readonly projectId: string;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly currency: CurrencyCode;
  readonly basePolicy: BasePolicy;
  readonly shares: readonly AllocationShare[];
  /** Rule versions referenced by an opportunity are frozen. Invariant 3. */
  readonly immutable: true;
}

export type SettlementStatus = 'pending' | 'approved';

export interface Settlement {
  readonly id: string;
  readonly opportunityId: string;
  readonly allocationRuleVersionId: string;
  readonly status: SettlementStatus;
  readonly base: Money;
  readonly approvedAt: string | null;
  readonly approvedByMemberId: string | null;
}

export type PayoutStatus = 'unpaid' | 'paid';

export interface SettlementLine {
  readonly id: string;
  readonly settlementId: string;
  readonly shareKey: string;
  readonly recipientKind: AllocationRecipientKind;
  readonly recipientLabel: string;
  readonly memberId: string | null;
  readonly roleLabel: string;
  /** Weight inside this line's share pool, not relative to the base. */
  readonly weightBp: BasisPoints;
  readonly amount: Money;
  readonly payoutStatus: PayoutStatus;
  readonly paidAt: string | null;
  readonly payoutCashEventId: string | null;
  /** Append-only ordering. Corrections append reversals, never rewrite. Invariant 7. */
  readonly sequence: number;
}
