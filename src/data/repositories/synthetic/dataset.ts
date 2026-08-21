/**
 * The only module permitted to import fixtures.
 *
 * It validates every record, maps the wire shape to domain types, and memoises the
 * result. When M2 lands, repositories query Supabase instead and this file is
 * deleted without any component changing.
 */

import { basisPoints, money } from '@/lib/money';
import { DataError } from '@/lib/result';
import {
  allocationRuleVersionRecordSchema,
  assignmentRecordSchema,
  cashEventRecordSchema,
  memberRecordSchema,
  opportunityRecordSchema,
  organizationRecordSchema,
  parseFixture,
  projectRecordSchema,
  serviceVersionRecordSchema,
  settlementLineRecordSchema,
  settlementRecordSchema,
} from '@/data/schemas';
import type {
  AllocationRuleVersion,
  Assignment,
  CashEvent,
  Member,
  Opportunity,
  Organization,
  Project,
  ServiceVersion,
  Settlement,
  SettlementLine,
} from '@/types/domain';

import organizationsRaw from '@/data/fixtures/organizations.json';
import membersRaw from '@/data/fixtures/members.json';
import setyProjectRaw from '@/data/fixtures/projects/sety-2026/project.json';
import setyServiceVersionsRaw from '@/data/fixtures/projects/sety-2026/service-versions.json';
import setyRulesRaw from '@/data/fixtures/projects/sety-2026/allocation-rule-versions.json';
import setyOpportunitiesRaw from '@/data/fixtures/projects/sety-2026/opportunities.json';
import setyAssignmentsRaw from '@/data/fixtures/projects/sety-2026/assignments.json';
import setyCashEventsRaw from '@/data/fixtures/projects/sety-2026/cash-events.json';
import setySettlementsRaw from '@/data/fixtures/projects/sety-2026/settlements.json';
import setySettlementLinesRaw from '@/data/fixtures/projects/sety-2026/settlement-lines.json';

export interface SyntheticDataset {
  readonly organizations: ReadonlyMap<string, Organization>;
  readonly members: ReadonlyMap<string, Member>;
  readonly projects: ReadonlyMap<string, Project>;
  readonly serviceVersions: ReadonlyMap<string, ServiceVersion>;
  readonly allocationRuleVersions: ReadonlyMap<string, AllocationRuleVersion>;
  readonly opportunities: readonly Opportunity[];
  readonly assignments: readonly Assignment[];
  readonly cashEvents: readonly CashEvent[];
  readonly settlements: readonly Settlement[];
  readonly settlementLines: readonly SettlementLine[];
}

function byId<T extends { id: string }>(records: readonly T[]): ReadonlyMap<string, T> {
  return new Map(records.map((record) => [record.id, record]));
}

function build(): SyntheticDataset {
  const organizations: Organization[] = parseFixture(
    'organizations',
    organizationRecordSchema,
    organizationsRaw,
  );

  const members: Member[] = parseFixture('members', memberRecordSchema, membersRaw);

  const projects: Project[] = parseFixture(
    'projects/sety-2026/project',
    projectRecordSchema,
    setyProjectRaw,
  );

  const serviceVersions: ServiceVersion[] = parseFixture(
    'projects/sety-2026/service-versions',
    serviceVersionRecordSchema,
    setyServiceVersionsRaw,
  );

  const allocationRuleVersions: AllocationRuleVersion[] = parseFixture(
    'projects/sety-2026/allocation-rule-versions',
    allocationRuleVersionRecordSchema,
    setyRulesRaw,
  ).map((record) => ({
    ...record,
    shares: record.shares.map((share) => ({
      ...share,
      weightBp: basisPoints(share.weightBp),
    })),
  }));

  const opportunities: Opportunity[] = parseFixture(
    'projects/sety-2026/opportunities',
    opportunityRecordSchema,
    setyOpportunitiesRaw,
  );

  const assignments: Assignment[] = parseFixture(
    'projects/sety-2026/assignments',
    assignmentRecordSchema,
    setyAssignmentsRaw,
  ).map((record) => ({ ...record, weightBp: basisPoints(record.weightBp) }));

  const cashEvents: CashEvent[] = parseFixture(
    'projects/sety-2026/cash-events',
    cashEventRecordSchema,
    setyCashEventsRaw,
  ).map(({ amountCentavos, currency, ...rest }) => ({
    ...rest,
    amount: money(amountCentavos, currency),
  }));

  const settlements: Settlement[] = parseFixture(
    'projects/sety-2026/settlements',
    settlementRecordSchema,
    setySettlementsRaw,
  ).map(({ baseCentavos, currency, ...rest }) => ({
    ...rest,
    base: money(baseCentavos, currency),
  }));

  const settlementLines: SettlementLine[] = parseFixture(
    'projects/sety-2026/settlement-lines',
    settlementLineRecordSchema,
    setySettlementLinesRaw,
  ).map(({ amountCentavos, currency, weightBp, ...rest }) => ({
    ...rest,
    weightBp: basisPoints(weightBp),
    amount: money(amountCentavos, currency),
  }));

  const approvedSettlementIds = new Set(
    settlements.filter((settlement) => settlement.status === 'approved').map((s) => s.id),
  );
  const orphanLines = settlementLines.filter(
    (line) => !approvedSettlementIds.has(line.settlementId),
  );
  if (orphanLines.length > 0) {
    throw new DataError(
      `Settlement lines exist without an approved settlement: ${orphanLines.map((l) => l.id).join(', ')}`,
    );
  }

  return {
    organizations: byId(organizations),
    members: byId(members),
    projects: byId(projects),
    serviceVersions: byId(serviceVersions),
    allocationRuleVersions: byId(allocationRuleVersions),
    opportunities,
    assignments,
    cashEvents,
    settlements,
    settlementLines,
  };
}

let cache: SyntheticDataset | undefined;

export function loadSyntheticDataset(): SyntheticDataset {
  cache ??= build();
  return cache;
}
