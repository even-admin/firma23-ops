/**
 * View models.
 *
 * A shared contract between repositories and components. Repositories produce
 * these; components consume them as props. Keeping them here rather than inside
 * the data layer is what lets a presentational component stay honestly ignorant
 * of where its data came from.
 */

import type { RailModel } from '@/lib/allocation';
import type { BasisPoints, CurrencyCode, Money } from '@/lib/money';
import type {
  Availability,
  CashEventType,
  EvidenceKind,
  ExtractionConfidence,
  MemberRole,
  MilestoneStatus,
  OpportunityStatus,
  PayoutStatus,
  ProjectStatus,
  ReviewIssueSeverity,
  SkillLevel,
  VerificationStatus,
} from '@/types/domain';
export type { ExtractionConfidence, ReviewIssueSeverity };

export interface MemberMoney {
  /** Settled by a founder. Real, owed or already paid. */
  readonly approved: Money;
  /** The part of approved money that has actually been paid out. */
  readonly paid: Money;
  /** Approved but still owed. */
  readonly approvedUnpaid: Money;
  /** Cash already paid beyond the currently approved amount after a reversal. */
  readonly recovery: Money;
  /** Not earned, not payable, never ranked. Shown apart from everything above. */
  readonly projected: Money;
}

/** Per-row money keeps the same firewall the rail uses. */
export type AssignmentMoney =
  | { readonly kind: 'projected'; readonly amount: Money }
  | { readonly kind: 'approved'; readonly amount: Money; readonly payoutStatus: PayoutStatus }
  | { readonly kind: 'correction_required' };

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

export type HomePerformanceMetricKey =
  | 'approved'
  | 'paid'
  | 'approved_unpaid'
  | 'projected'
  | 'closed';

export type HomePerformancePointState = 'verified' | 'correction' | 'recovery';

interface HomePerformancePointBase {
  readonly id: string;
  readonly occurredAt: string;
  readonly sourceLabel: string;
  readonly state: HomePerformancePointState;
}

export interface HomeMoneyPerformancePoint extends HomePerformancePointBase {
  readonly value: Money;
  readonly delta: Money;
}

export interface HomeCountPerformancePoint extends HomePerformancePointBase {
  readonly value: number;
  readonly delta: number;
}

export interface HomeMoneyPerformanceSeries {
  readonly kind: 'money';
  readonly key: Exclude<HomePerformanceMetricKey, 'closed'>;
  readonly current: Money;
  /**
   * `unavailable` means the current value is authoritative but no dated event
   * history exists. The UI must not turn that value into a fabricated line.
   */
  readonly historyAvailability: 'available' | 'unavailable';
  readonly points: readonly HomeMoneyPerformancePoint[];
}

export interface HomeCountPerformanceSeries {
  readonly kind: 'count';
  readonly key: 'closed';
  readonly current: number;
  readonly historyAvailability: 'available';
  readonly points: readonly HomeCountPerformancePoint[];
}

export type HomePerformanceSeries =
  | HomeMoneyPerformanceSeries
  | HomeCountPerformanceSeries;

export interface HomePerformanceHistory {
  /** Repository snapshot boundary used by deterministic period filters. */
  readonly asOf: string;
  readonly series: readonly HomePerformanceSeries[];
}

export interface PersonalHome {
  readonly member: {
    readonly id: string;
    readonly displayName: string;
    readonly initials: string;
    readonly role: MemberRole;
  };
  readonly money: MemberMoney;
  readonly performance: HomePerformanceHistory;
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

/**
 * One member_pool share's assignment-weight total, independent of every
 * other pool. A rule may define more than one (SETY has closer and
 * delivery); each must reach 10,000bp on its own, so this is never
 * aggregated into a single scalar across pools.
 */
export interface PoolWeightView {
  readonly key: string;
  readonly label: string;
  readonly totalBp: number;
  readonly balanced: boolean;
}

/** Immutable founder-audit evidence for one pool-scoped crew replacement. */
export interface CrewChangeAssignmentView {
  readonly memberId: string;
  readonly roleLabel: string;
  readonly weightBp: BasisPoints;
}

export interface CrewChangeReceiptView {
  readonly id: string;
  readonly roleKey: string;
  readonly beforeAssignments: readonly CrewChangeAssignmentView[];
  readonly afterAssignments: readonly CrewChangeAssignmentView[];
  readonly createdAt: string;
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
  readonly pools: readonly PoolWeightView[];
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
  /** Present only for founders or the row's own member. Never zero-filled for privacy. */
  readonly paidEarnings?: Money;
  /** Present only for founders or the row's own member. Never ranked or added to approved. */
  readonly projectedEarnings?: Money;
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
  /** Historical cash paid beyond current approval after a reversal. */
  readonly recovery: Money;
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
  /** Non-ledger planning value. Never used for cash, approval, or paid totals. */
  readonly projectedDistributableBase: Money;
  readonly distributableBase: Money;
  /** Actual receipts, separately shown from both projection and approved base. */
  readonly cashReceived: Money;
  readonly basePolicyLabel: string;
  readonly basePolicyNote: string;
  readonly cashEvents: readonly CashEventView[];
  /** Settlement readiness requires every pool here to be independently balanced. */
  readonly pools: readonly PoolWeightView[];
  readonly milestonesOutstanding: number;
  /** M1 never approves. This states why the control is disabled. */
  readonly approvalBlockedReason: string;
}

// ---------------------------------------------------------------------------
// Canonical finance write boundary (P3)
//
// The synthetic/local-adapter mode has no write path for any of these at
// all — every implementation there returns `unavailable`, never a faked
// `recorded`/`approved`/`reversed`/`reversed` result. Only the Supabase
// adapter, calling the audited record_cash_event/approve_settlement/
// reverse_settlement/record_payout RPCs, can produce those.
// ---------------------------------------------------------------------------

export interface RecordCashEventInput {
  readonly opportunityId: string;
  readonly type: CashEventType;
  readonly label: string;
  readonly amount: Money;
  readonly occurredAt: string;
  /** Supplied by the caller per attempt; a retry with the same key never double-posts. */
  readonly idempotencyKey: string;
}

export type RecordCashEventResult =
  | { readonly kind: 'recorded'; readonly cashEventId: string; readonly replayed: boolean }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

export interface ApproveSettlementInput {
  readonly opportunityId: string;
  readonly idempotencyKey: string;
}

export type ApproveSettlementResult =
  | { readonly kind: 'approved'; readonly settlementId: string; readonly replayed: boolean }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

export interface ReverseSettlementInput {
  readonly settlementId: string;
  readonly idempotencyKey: string;
}

export type ReverseSettlementResult =
  | {
      readonly kind: 'reversed';
      readonly settlementId: string;
      readonly replayed: boolean;
      /**
       * Payout money already allocated against the reversed original that has not yet been reallocated onto a replacement settlement.
       * Reported, not enforced: nothing requires a founder to ever clear this. A founder-visible queue surfacing it is deferred to the final founder finance UI — this field exists so that surface has a value to read once it's built.
       */
      readonly outstandingPayoutCentavos: number;
    }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

/** One line's payout allocation. Positive pays it; negative transfers/corrects a prior allocation away from it. */
export interface RecordPayoutAllocationInput {
  readonly settlementLineId: string;
  readonly amount: Money;
}

export interface RecordPayoutInput {
  readonly opportunityId: string;
  readonly label: string;
  readonly occurredAt: string;
  readonly allocations: readonly RecordPayoutAllocationInput[];
  readonly idempotencyKey: string;
  /**
   * Null creates a brand-new payout cash event (every allocation must be
   * positive). Set to reallocate against a historical payout event instead
   * — the reverse-and-reissue transfer pattern — which requires the batch
   * to net to exactly zero so the event's own total never changes.
   */
  readonly existingCashEventId?: string | null;
}

export type RecordPayoutResult =
  | { readonly kind: 'recorded'; readonly cashEventId: string; readonly replayed: boolean }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

// ---------------------------------------------------------------------------
// Document-first contract intake
// ---------------------------------------------------------------------------

export interface SourceEvidenceView {
  readonly locationLabel: string;
  readonly quote: string;
}

export interface DraftFieldView {
  readonly label: string;
  readonly value: string;
  readonly confidence: ExtractionConfidence;
  readonly evidence: readonly SourceEvidenceView[];
}

export interface DraftServiceView {
  readonly name: string;
  readonly version: number;
  readonly deliverablesSummary: string;
  readonly milestoneCount: number;
}

export interface DraftMilestoneView {
  readonly position: number;
  readonly name: string;
  readonly description: string;
  readonly serviceName: string;
}

export interface DraftAssignmentSuggestionView {
  readonly roleLabel: string;
  readonly shareOfBaseLabel: string;
  readonly rationale: string;
  readonly confidence: ExtractionConfidence;
}

export interface ReviewIssueView {
  readonly severity: ReviewIssueSeverity;
  readonly fieldLabel: string;
  readonly detail: string;
}

/**
 * Where a draft came from. A manual draft has no AI extraction at all — no
 * confidence, no evidence — because a founder typed it directly; the review
 * UI must not imply an AI read something that never happened.
 */
export type ContractDraftOrigin = 'ai_extracted' | 'manual';

export interface ContractDraftView {
  readonly id: string | null;
  readonly origin: ContractDraftOrigin;
  /**
   * Structured for the confirmation action, which needs these two strings
   * on their own. `fields` below carries the same values back out again for
   * display, alongside every other extracted field with its confidence and
   * evidence — display and confirmation input are different shapes on
   * purpose, so the confirm action never has to search a display list by
   * label text to recover a value it already has.
   */
  readonly sponsorName: string;
  readonly programName: string;
  readonly sourceDocumentName: string | null;
  readonly sourceDocumentKindLabel: string | null;
  readonly extractedAt: string | null;
  /** An existing project/contract the draft matched. AI never creates one. */
  readonly matchedProjectName: string | null;
  readonly matchedProjectSlug: string | null;
  readonly fields: readonly DraftFieldView[];
  readonly services: readonly DraftServiceView[];
  readonly milestones: readonly DraftMilestoneView[];
  readonly assignments: readonly DraftAssignmentSuggestionView[];
  /**
   * Always a projection, never an approved settlement. Null for a manual
   * draft naming a brand-new contract: there is no allocation rule yet to
   * project against, and inventing one here would be exactly the kind of
   * component-owned financial rule AGENTS.md forbids.
   */
  readonly projectedAllocation: RailModel | null;
  readonly projectedAllocationNote: string | null;
  readonly reviewIssues: readonly ReviewIssueView[];
  readonly confidenceOverall: ExtractionConfidence | null;
}

export interface RunIntakeInput {
  readonly sourceDocumentFilename: string;
  /**
   * Supplied by the client per upload attempt. Retrying the same attempt
   * (a double-click, a retried request after a dropped connection) must
   * never spawn a second run — the Supabase adapter's run_intake() enforces
   * this with a unique constraint; the synthetic adapter has no persistence
   * to dedupe against, so it simply always returns the one fixture draft.
   */
  readonly idempotencyKey: string;
}

/**
 * Confirms a draft — AI-extracted (draftId set) or manually entered
 * (draftId null) — into a real contract/project row. This is the one place
 * in the whole intake surface that is allowed to create canonical state; AI
 * output alone never reaches this without a founder calling it.
 */
export interface ConfirmContractDraftInput {
  readonly draftId: string | null;
  readonly sponsorName: string;
  readonly programName: string;
  readonly currency: CurrencyCode;
}

export type ConfirmContractDraftResult =
  | { readonly kind: 'confirmed'; readonly projectId: string; readonly projectSlug: string }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

export type DiscardContractDraftResult =
  | { readonly kind: 'discarded' }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

export interface AssignmentPickerMember {
  readonly memberId: string;
  readonly displayName: string;
  readonly role: MemberRole;
}

/** Founder-only roster entry. An invite is a local access record, not proof
 * that an email was sent or that the recipient has activated their account. */
export interface MemberInviteView {
  readonly inviteId: string;
  readonly memberId: string;
  readonly displayName: string;
  readonly email: string;
  readonly membershipStatus: 'invited' | 'active' | 'revoked';
  readonly invitedAt: string;
  readonly expiresAt: string;
  readonly redeemedAt: string | null;
}

export interface CreateMemberInviteInput {
  readonly displayName: string;
  readonly email: string;
  readonly idempotencyKey: string;
}

export type CreateMemberInviteResult =
  | { readonly kind: 'created'; readonly memberId: string; readonly inviteId: string; readonly replayed: boolean }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

export interface ManualContractSetupAssignmentInput {
  readonly memberId: string;
  readonly roleLabel: string;
  readonly weightBp: BasisPoints;
}

export interface ManualContractSetupInput {
  readonly clientName: string;
  readonly contractName: string;
  readonly serviceScope: string;
  readonly projectedBaseCentavos: number;
  readonly currency: CurrencyCode;
  readonly firma23ShareBp: BasisPoints;
  readonly assignments: readonly ManualContractSetupAssignmentInput[];
  readonly idempotencyKey: string;
}

export type ManualContractSetupResult =
  | {
      readonly kind: 'created';
      readonly projectId: string;
      readonly projectSlug: string;
      readonly opportunityId: string;
      readonly replayed: boolean;
    }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

export interface ReplaceOpportunityCrewAssignmentInput {
  readonly memberId: string;
  readonly roleLabel: string;
  readonly weightBp: BasisPoints;
}

export interface ReplaceOpportunityCrewInput {
  readonly opportunityId: string;
  readonly roleKey: string;
  readonly assignments: readonly ReplaceOpportunityCrewAssignmentInput[];
  readonly idempotencyKey: string;
}

export type ReplaceOpportunityCrewResult =
  | { readonly kind: 'replaced'; readonly opportunityId: string; readonly replayed: boolean }
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string };

export type IntakeRunStatus = 'idle' | 'processing' | 'ready' | 'error';

export interface IntakeRunView {
  readonly id: string;
  readonly status: IntakeRunStatus;
  readonly sourceDocumentName: string | null;
  readonly draft: ContractDraftView | null;
  readonly errorMessage: string | null;
  /** True everywhere until a real document-parsing and AI provider boundary exists. */
  readonly synthetic: true;
}
