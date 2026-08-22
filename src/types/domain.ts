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

export interface MilestoneTemplate {
  readonly id: string;
  readonly serviceVersionId: string;
  readonly position: number;
  readonly name: string;
  readonly description: string;
}

export type MilestoneStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export interface OpportunityMilestone {
  readonly id: string;
  readonly opportunityId: string;
  readonly templateId: string;
  readonly position: number;
  readonly name: string;
  readonly status: MilestoneStatus;
  readonly dueAt: string | null;
  readonly completedAt: string | null;
  readonly assignedMemberId: string | null;
}

export type EvidenceKind = 'link' | 'image' | 'video' | 'document';

export interface EvidenceLink {
  readonly id: string;
  readonly opportunityMilestoneId: string;
  readonly label: string;
  readonly url: string;
  readonly kind: EvidenceKind;
  readonly submittedByMemberId: string;
  readonly submittedAt: string;
}

export type SkillLevel = 'learning' | 'working' | 'strong' | 'lead';
export type VerificationStatus = 'self_reported' | 'verified';

export interface Skill {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly family: string;
}

export interface MemberSkill {
  readonly id: string;
  readonly memberId: string;
  readonly skillId: string;
  readonly level: SkillLevel;
  readonly verification: VerificationStatus;
}

export type Availability = 'open' | 'limited' | 'unavailable';

export interface MemberProfile {
  readonly memberId: string;
  readonly bio: string;
  readonly availability: Availability;
  readonly nextCapability: string;
  readonly joinedAt: string;
}

export interface PortfolioItem {
  readonly id: string;
  readonly memberId: string;
  readonly title: string;
  readonly roleLabel: string;
  readonly url: string;
  readonly kind: EvidenceKind;
  readonly verification: VerificationStatus;
  readonly completedAt: string;
}

export type StatEventType =
  | 'opportunity_closed'
  | 'delivery_completed'
  | 'delivered_on_time'
  | 'delivered_late'
  | 'revision_requested'
  | 'accepted_first_pass';

export interface StatEvent {
  readonly id: string;
  readonly memberId: string;
  readonly opportunityId: string;
  readonly type: StatEventType;
  readonly occurredAt: string;
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

// ---------------------------------------------------------------------------
// Document-first contract intake
//
// A founder starts a contract by dropping an existing proposal, executive
// report, deck, quote, or SOW instead of filling a blank form. The AI adapter
// reads that document and produces a draft: never a contract, opportunity,
// assignment, or allocation a founder has not confirmed. These types mirror
// the source-documents and intake-runs/drafts tables proposed for M2; M1 keeps
// them as versioned fixture data read by a deterministic local adapter.
// ---------------------------------------------------------------------------

export type SourceDocumentKind = 'proposal' | 'executive_report' | 'deck' | 'quote' | 'sow';

export interface SourceDocument {
  readonly id: string;
  readonly orgId: string;
  readonly filename: string;
  readonly kind: SourceDocumentKind;
  readonly uploadedAt: string;
}

/** How sure the adapter is about one extracted value, never a fact about the value itself. */
export type ExtractionConfidence = 'high' | 'medium' | 'low';

/** Where in the source document a value came from. Lets a founder verify before trusting it. */
export interface SourceEvidence {
  readonly locationLabel: string;
  readonly quote: string;
}

export interface ExtractedField<T> {
  readonly value: T;
  readonly confidence: ExtractionConfidence;
  readonly evidence: readonly SourceEvidence[];
}

export type ReviewIssueSeverity = 'missing' | 'ambiguous';

/** A field the founder must resolve before a draft can become canonical. */
export interface ReviewIssue {
  readonly key: string;
  readonly severity: ReviewIssueSeverity;
  readonly fieldLabel: string;
  readonly detail: string;
}

/**
 * A role the AI thinks the confirmed rule will need, never a specific person.
 * Member matching needs a beneficiary and skill/availability filtering, which
 * only exists once an opportunity is created from a confirmed contract.
 */
export interface DraftAssignmentSuggestion {
  readonly key: string;
  readonly roleKey: AssignmentRoleKey;
  readonly rationale: string;
  readonly confidence: ExtractionConfidence;
}

/**
 * The AI's read of a source document.
 *
 * This is draft-only by construction: nothing here is an id an opportunity,
 * assignment, or settlement can reference. A founder confirming a draft is a
 * separate, human action this type cannot represent.
 */
export interface AiContractDraft {
  readonly id: string;
  readonly sourceDocumentId: string;
  readonly orgId: string;
  /** An existing project/contract the AI matched. AI never creates one. */
  readonly matchedProjectId: string | null;
  readonly matchedServiceVersionIds: readonly string[];
  readonly matchedAllocationRuleVersionId: string | null;
  readonly extractedAt: string;
  readonly sponsorName: ExtractedField<string>;
  readonly programName: ExtractedField<string>;
  readonly currency: CurrencyCode;
  /** An example base drawn from real, already-recorded cash events, not a contract total. */
  readonly exampleDistributableBase: ExtractedField<Money>;
  readonly exampleDistributableBaseNote: string;
  readonly reviewIssues: readonly ReviewIssue[];
  readonly suggestedAssignments: readonly DraftAssignmentSuggestion[];
}

export type IntakeRunStatus = 'idle' | 'processing' | 'ready' | 'error';

export interface IntakeRun {
  readonly id: string;
  readonly orgId: string;
  readonly status: IntakeRunStatus;
  readonly sourceDocumentId: string | null;
  readonly draftId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  /** True everywhere until a real document-parsing and AI provider boundary exists. */
  readonly synthetic: true;
}
