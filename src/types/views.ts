/**
 * View models.
 *
 * A shared contract between repositories and components. Repositories produce
 * these; components consume them as props. Keeping them here rather than inside
 * the data layer is what lets a presentational component stay honestly ignorant
 * of where its data came from.
 */

import type { RailModel } from '@/lib/allocation';
import type { BasisPoints, Money } from '@/lib/money';
import type {
  Availability,
  CashEventType,
  EvidenceKind,
  MemberRole,
  MilestoneStatus,
  OpportunityStatus,
  PayoutStatus,
  ProjectStatus,
  SkillLevel,
  VerificationStatus,
} from '@/types/domain';

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

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ProjectServiceView {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly deliverablesSummary: string;
  readonly milestoneCount: number;
}

export interface ProjectRuleShareView {
  readonly key: string;
  readonly label: string;
  readonly weightBp: BasisPoints;
}

export interface ProjectRuleView {
  readonly id: string;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly basePolicyLabel: string;
  readonly basePolicyNote: string;
  readonly shares: readonly ProjectRuleShareView[];
}

export interface ProjectSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly sponsorName: string;
  readonly status: ProjectStatus;
  readonly serviceCount: number;
  readonly opportunityCount: number;
  readonly activeRule: ProjectRuleView | null;
  /** Approved money only. Projections are never aggregated into a project total. */
  readonly approvedSettled: Money;
}

export interface ProjectDetail extends ProjectSummary {
  readonly services: readonly ProjectServiceView[];
  readonly rules: readonly ProjectRuleView[];
  readonly opportunities: readonly OpportunitySummary[];
}

// ---------------------------------------------------------------------------
// Opportunity detail
// ---------------------------------------------------------------------------

export interface EvidenceView {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly kind: EvidenceKind;
  readonly submittedByName: string;
  readonly submittedAt: string;
}

export interface MilestoneView {
  readonly id: string;
  readonly position: number;
  readonly name: string;
  readonly description: string;
  readonly status: MilestoneStatus;
  readonly dueAt: string | null;
  readonly completedAt: string | null;
  readonly assignedMemberName: string | null;
  readonly assignedMemberInitials: string | null;
  readonly evidence: readonly EvidenceView[];
}

export interface AssignmentView {
  readonly id: string;
  readonly memberId: string;
  readonly memberSlug: string;
  readonly displayName: string;
  readonly initials: string;
  readonly roleKey: string;
  readonly roleLabel: string;
  readonly weightBp: BasisPoints;
  readonly status: string;
}

export interface CashEventView {
  readonly id: string;
  readonly type: CashEventType;
  readonly label: string;
  readonly amount: Money;
  readonly occurredAt: string;
  readonly countsTowardBase: boolean;
}

export interface OpportunityDetail {
  readonly summary: OpportunitySummary;
  readonly rail: RailModel;
  readonly distributableBase: Money;
  readonly basePolicyLabel: string;
  readonly basePolicyNote: string;
  readonly cashReceived: Money;
  readonly cashEvents: readonly CashEventView[];
  readonly milestones: readonly MilestoneView[];
  readonly assignments: readonly AssignmentView[];
  readonly milestonesDone: number;
  readonly deliveryWeightTotalBp: number;
}

// ---------------------------------------------------------------------------
// Member directory and profiles
// ---------------------------------------------------------------------------

export interface SkillView {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly level: SkillLevel;
  readonly verification: VerificationStatus;
}

export interface PortfolioView {
  readonly id: string;
  readonly title: string;
  readonly roleLabel: string;
  readonly url: string;
  readonly kind: EvidenceKind;
  readonly verification: VerificationStatus;
  readonly completedAt: string;
}

/** Derived from append-only stat events. A member can never edit these. */
export interface MemberStats {
  readonly closed: number;
  readonly delivered: number;
  readonly onTime: number;
  readonly late: number;
  readonly revisionsRequested: number;
  readonly acceptedFirstPass: number;
  /** Basis points, or null when there is nothing to rate yet. */
  readonly onTimeRateBp: BasisPoints | null;
  readonly acceptanceRateBp: BasisPoints | null;
}

export interface OperatorCardView {
  readonly memberId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly initials: string;
  readonly role: MemberRole;
  readonly bio: string;
  readonly availability: Availability;
  readonly nextCapability: string;
  readonly joinedAt: string;
  readonly skills: readonly SkillView[];
  readonly stats: MemberStats;
  /** Approved earnings only. Projections never appear on a profile total. */
  readonly approvedEarnings: Money;
  readonly paidEarnings: Money;
  readonly activeWorkCount: number;
}

export interface OperatorProfile extends OperatorCardView {
  readonly portfolio: readonly PortfolioView[];
  readonly recentWork: readonly HomeAssignment[];
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardRow {
  readonly rank: number;
  readonly memberId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly initials: string;
  /** The only figure the ranking uses. */
  readonly approvedEarnings: Money;
  readonly paidEarnings: Money;
  /** Shown alongside, never ranked, never added to approved. */
  readonly projectedEarnings: Money;
  readonly closed: number;
  readonly delivered: number;
  readonly onTimeRateBp: BasisPoints | null;
}

export interface ProvenanceEntry {
  readonly settlementId: string;
  readonly opportunityId: string;
  readonly opportunityCode: string;
  readonly beneficiaryName: string;
  readonly projectName: string;
  readonly roleLabel: string;
  readonly amount: Money;
  readonly payoutStatus: PayoutStatus;
  readonly approvedAt: string;
  readonly approvedByName: string;
}

export interface LeaderboardProvenance {
  readonly memberId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly approvedEarnings: Money;
  readonly paidEarnings: Money;
  readonly entries: readonly ProvenanceEntry[];
}

// ---------------------------------------------------------------------------
// Founder finance
// ---------------------------------------------------------------------------

export interface FinanceTotals {
  readonly cashReceived: Money;
  readonly distributableApproved: Money;
  readonly distributableProjected: Money;
  readonly paidOut: Money;
  readonly owed: Money;
  readonly houseApproved: Money;
}

export interface FinanceRow {
  readonly opportunity: OpportunitySummary;
  readonly rail: RailModel;
  readonly distributableBase: Money;
  readonly cashReceived: Money;
  readonly cashEvents: readonly CashEventView[];
}

export interface FinanceOverview {
  readonly totals: FinanceTotals;
  readonly rows: readonly FinanceRow[];
  readonly pendingApprovals: number;
}

export interface SettlementPreview {
  readonly opportunity: OpportunitySummary;
  readonly rail: RailModel;
  readonly distributableBase: Money;
  readonly basePolicyLabel: string;
  readonly basePolicyNote: string;
  readonly cashEvents: readonly CashEventView[];
  readonly deliveryWeightTotalBp: number;
  readonly weightsBalanced: boolean;
  readonly milestonesOutstanding: number;
  /** M1 never approves. This states why the control is disabled. */
  readonly approvalBlockedReason: string;
}
