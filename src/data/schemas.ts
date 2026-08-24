/**
 * Fixture schemas.
 *
 * These validate the shape of every synthetic record at load time, so a drifted
 * or malformed fixture fails the test suite instead of rendering wrong money.
 *
 * They are written to be reusable in M2 as the parser for Supabase rows, which is
 * why they describe the wire shape (integer centavos, plain strings) rather than
 * the domain shape.
 */

import { z } from 'zod';
import { DataError } from '@/lib/result';

export const FIXTURE_VERSION = 1;

const id = z.string().uuid();
const label = z.string().min(1);
const dateish = z.string().min(4);
const currency = z.string().regex(/^[A-Z]{3}$/, 'currency must be an uppercase ISO 4217 code');
const centavosValue = z.number().int();
const weight = z.number().int().min(0).max(10_000);

export const cashEventTypeSchema = z.enum([
  'invoice',
  'withholding',
  'deposit',
  'contribution',
  'adjustment',
  'payout',
]);

export const organizationRecordSchema = z.object({ id, slug: label, name: label }).strict();

export const memberRecordSchema = z
  .object({
    id,
    slug: label,
    displayName: label,
    initials: z.string().min(1).max(4),
    role: z.enum(['founder', 'member']),
    orgId: id,
  })
  .strict();

export const projectRecordSchema = z
  .object({
    id,
    slug: label,
    name: label,
    sponsorName: label,
    status: z.enum(['draft', 'active', 'closed']),
    currency,
    activeAllocationRuleVersionId: id.nullable(),
  })
  .strict();

export const serviceVersionRecordSchema = z
  .object({
    id,
    projectId: id,
    key: label,
    name: label,
    version: z.number().int().positive(),
    deliverablesSummary: label,
    immutable: z.literal(true),
  })
  .strict();

export const basePolicyRecordSchema = z
  .object({
    kind: z.literal('cash_event_types'),
    includeTypes: z.array(cashEventTypeSchema).min(1),
    label,
    note: label,
  })
  .strict();

export const allocationRecipientBehaviorSchema = z.enum(['org_recipient', 'member_pool']);

export const allocationShareRecordSchema = z
  .object({
    key: label,
    recipientBehavior: allocationRecipientBehaviorSchema,
    label,
    weightBp: weight,
    recipientOrgId: id.nullable(),
  })
  .strict();

export const allocationRuleVersionRecordSchema = z
  .object({
    id,
    projectId: id,
    version: z.number().int().positive(),
    effectiveFrom: dateish,
    currency,
    immutable: z.literal(true),
    basePolicy: basePolicyRecordSchema,
    shares: z.array(allocationShareRecordSchema).min(1),
  })
  .strict();

export const opportunityRecordSchema = z
  .object({
    id,
    projectId: id,
    serviceVersionId: id,
    allocationRuleVersionId: id,
    code: label,
    beneficiaryName: label,
    beneficiaryLocation: label,
    status: z.enum([
      'draft',
      'assigned',
      'in_delivery',
      'delivered',
      'settled_approved',
      'paid',
      'cancelled',
    ]),
    openedAt: dateish,
  })
  .strict();

export const assignmentRecordSchema = z
  .object({
    id,
    opportunityId: id,
    memberId: id,
    // Project-defined pool key, not a fixed pair; validated against the
    // opportunity's own allocation rule version at the database layer.
    roleKey: label,
    roleLabel: label,
    weightBp: weight,
    status: z.enum(['proposed', 'approved']),
  })
  .strict();

export const cashEventRecordSchema = z
  .object({
    id,
    opportunityId: id,
    type: cashEventTypeSchema,
    label,
    amountCentavos: centavosValue,
    currency,
    occurredAt: dateish,
  })
  .strict();

export const settlementKindSchema = z.enum(['original', 'reversal', 'adjustment']);

export const settlementRecordSchema = z
  .object({
    id,
    opportunityId: id,
    allocationRuleVersionId: id,
    status: z.enum(['pending', 'approved']),
    kind: settlementKindSchema,
    correctsSettlementId: id.nullable(),
    // Signed: an 'original' base is non-negative, a 'reversal' base is its
    // exact negation (non-positive). Not re-validated by sign here; the
    // database enforces the kind/sign relationship at the constraint layer.
    baseCentavos: centavosValue,
    currency,
    approvedAt: dateish.nullable(),
    approvedByMemberId: id.nullable(),
  })
  .strict();

export const settlementLineRecordSchema = z
  .object({
    id,
    settlementId: id,
    shareKey: label,
    recipientBehavior: allocationRecipientBehaviorSchema,
    recipientLabel: label,
    memberId: id.nullable(),
    roleLabel: label,
    weightBp: weight,
    amountCentavos: centavosValue,
    currency,
    sequence: z.number().int().positive(),
  })
  .strict();

export const settlementLinePayoutRecordSchema = z
  .object({
    id,
    settlementLineId: id,
    payoutCashEventId: id,
    amountCentavos: centavosValue.refine((value) => value !== 0, 'amountCentavos must be nonzero'),
    currency,
    createdAt: dateish,
    createdByMemberId: id,
    idempotencyKey: label,
  })
  .strict();

export const milestoneTemplateRecordSchema = z
  .object({
    id,
    serviceVersionId: id,
    position: z.number().int().positive(),
    name: label,
    description: label,
  })
  .strict();

export const opportunityMilestoneRecordSchema = z
  .object({
    id,
    opportunityId: id,
    templateId: id,
    position: z.number().int().positive(),
    name: label,
    status: z.enum(['pending', 'in_progress', 'done', 'blocked']),
    dueAt: dateish.nullable(),
    completedAt: dateish.nullable(),
    assignedMemberId: id.nullable(),
  })
  .strict();

const evidenceKind = z.enum(['link', 'image', 'video', 'document']);

/** Evidence URLs are synthetic. A real host here would be a privacy leak. */
const syntheticUrl = z
  .string()
  .url()
  .refine((value) => value.includes('.test/') || value.endsWith('.test'), {
    message: 'Fixture URLs must use a reserved .test host',
  });

export const evidenceLinkRecordSchema = z
  .object({
    id,
    opportunityMilestoneId: id,
    label,
    url: syntheticUrl,
    kind: evidenceKind,
    submittedByMemberId: id,
    submittedAt: dateish,
  })
  .strict();

export const skillRecordSchema = z.object({ id, key: label, name: label, family: label }).strict();

export const memberSkillRecordSchema = z
  .object({
    id,
    memberId: id,
    skillId: id,
    level: z.enum(['learning', 'working', 'strong', 'lead']),
    verification: z.enum(['self_reported', 'verified']),
  })
  .strict();

export const memberProfileRecordSchema = z
  .object({
    memberId: id,
    bio: label,
    availability: z.enum(['open', 'limited', 'unavailable']),
    nextCapability: label,
    joinedAt: dateish,
  })
  .strict();

export const portfolioItemRecordSchema = z
  .object({
    id,
    memberId: id,
    title: label,
    roleLabel: label,
    url: syntheticUrl,
    kind: evidenceKind,
    verification: z.enum(['self_reported', 'verified']),
    completedAt: dateish,
  })
  .strict();

export const statMetricKeySchema = z.enum([
  'opportunity_closed',
  'delivery_completed',
  'delivered_on_time',
  'delivered_late',
  'revision_requested',
  'accepted_first_pass',
]);

export const statEventRecordSchema = z
  .object({
    id,
    memberId: id,
    opportunityId: id,
    metricKey: statMetricKeySchema,
    quantity: z.number().int(),
    sourceKind: label,
    sourceId: id,
    reversesStatEventId: id.nullable(),
    occurredAt: dateish,
  })
  .strict();

export const sourceDocumentKindSchema = z.enum([
  'proposal',
  'executive_report',
  'deck',
  'quote',
  'sow',
]);

export const extractionConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const sourceEvidenceRecordSchema = z.object({ locationLabel: label, quote: label }).strict();

const extractedTextFieldRecordSchema = z
  .object({
    value: label,
    confidence: extractionConfidenceSchema,
    evidence: z.array(sourceEvidenceRecordSchema).min(1),
  })
  .strict();

const extractedMoneyFieldRecordSchema = z
  .object({
    amountCentavos: centavosValue,
    currency,
    confidence: extractionConfidenceSchema,
    evidence: z.array(sourceEvidenceRecordSchema).min(1),
  })
  .strict();

export const sourceDocumentRecordSchema = z
  .object({
    id,
    orgId: id,
    filename: label,
    kind: sourceDocumentKindSchema,
    uploadedAt: dateish,
  })
  .strict();

export const reviewIssueRecordSchema = z
  .object({
    key: label,
    severity: z.enum(['missing', 'ambiguous']),
    fieldLabel: label,
    detail: label,
  })
  .strict();

export const draftAssignmentSuggestionRecordSchema = z
  .object({
    key: label,
    roleKey: label,
    rationale: label,
    confidence: extractionConfidenceSchema,
  })
  .strict();

export const aiContractDraftRecordSchema = z
  .object({
    id,
    sourceDocumentId: id,
    orgId: id,
    matchedProjectId: id.nullable(),
    matchedServiceVersionIds: z.array(id).min(1),
    matchedAllocationRuleVersionId: id.nullable(),
    extractedAt: dateish,
    sponsorName: extractedTextFieldRecordSchema,
    programName: extractedTextFieldRecordSchema,
    currency,
    exampleDistributableBase: extractedMoneyFieldRecordSchema,
    exampleDistributableBaseNote: label,
    reviewIssues: z.array(reviewIssueRecordSchema),
    suggestedAssignments: z.array(draftAssignmentSuggestionRecordSchema),
  })
  .strict();

export type OrganizationRecord = z.infer<typeof organizationRecordSchema>;
export type MemberRecord = z.infer<typeof memberRecordSchema>;
export type ProjectRecord = z.infer<typeof projectRecordSchema>;
export type ServiceVersionRecord = z.infer<typeof serviceVersionRecordSchema>;
export type AllocationRuleVersionRecord = z.infer<typeof allocationRuleVersionRecordSchema>;
export type OpportunityRecord = z.infer<typeof opportunityRecordSchema>;
export type AssignmentRecord = z.infer<typeof assignmentRecordSchema>;
export type CashEventRecord = z.infer<typeof cashEventRecordSchema>;
export type SettlementRecord = z.infer<typeof settlementRecordSchema>;
export type SettlementLineRecord = z.infer<typeof settlementLineRecordSchema>;
export type SettlementLinePayoutRecord = z.infer<typeof settlementLinePayoutRecordSchema>;
export type StatEventRecord = z.infer<typeof statEventRecordSchema>;

/** Validate one fixture file envelope and return its records. */
export function parseFixture<T>(name: string, schema: z.ZodType<T>, raw: unknown): T[] {
  const envelope = z
    .object({
      fixtureVersion: z.literal(FIXTURE_VERSION),
      records: z.array(schema),
    })
    .strict()
    .safeParse(raw);

  if (!envelope.success) {
    throw new DataError(`Fixture "${name}" failed validation: ${envelope.error.message}`);
  }
  return envelope.data.records;
}
