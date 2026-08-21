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
const currency = z.literal('MXN');
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

export const allocationShareRecordSchema = z
  .object({
    key: label,
    kind: z.enum(['house', 'closer', 'delivery_pool']),
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
    roleKey: z.enum(['closer', 'delivery']),
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

export const settlementRecordSchema = z
  .object({
    id,
    opportunityId: id,
    allocationRuleVersionId: id,
    status: z.enum(['pending', 'approved']),
    baseCentavos: centavosValue.nonnegative(),
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
    recipientKind: z.enum(['house', 'closer', 'delivery_pool']),
    recipientLabel: label,
    memberId: id.nullable(),
    roleLabel: label,
    weightBp: weight,
    amountCentavos: centavosValue,
    currency,
    payoutStatus: z.enum(['unpaid', 'paid']),
    paidAt: dateish.nullable(),
    payoutCashEventId: id.nullable(),
    sequence: z.number().int().positive(),
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
