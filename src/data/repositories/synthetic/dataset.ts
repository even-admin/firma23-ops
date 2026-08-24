/**
 * The only module permitted to import fixtures.
 *
 * It validates every record, maps the wire shape to domain types, and memoises the
 * result. When M2 lands, repositories query Supabase instead and this file is
 * deleted without any component changing.
 *
 * Projects arrive as bundles so adding one is a data change plus one import, and
 * so no project can skip the shared validation path.
 */

import { assertCurrencyCode, basisPoints, money } from '@/lib/money';
import { DataError } from '@/lib/result';
import {
  aiContractDraftRecordSchema,
  allocationRuleVersionRecordSchema,
  assignmentRecordSchema,
  cashEventRecordSchema,
  evidenceLinkRecordSchema,
  memberProfileRecordSchema,
  memberRecordSchema,
  memberSkillRecordSchema,
  milestoneTemplateRecordSchema,
  opportunityMilestoneRecordSchema,
  opportunityRecordSchema,
  organizationRecordSchema,
  parseFixture,
  portfolioItemRecordSchema,
  projectRecordSchema,
  serviceVersionRecordSchema,
  settlementLinePayoutRecordSchema,
  settlementLineRecordSchema,
  settlementRecordSchema,
  skillRecordSchema,
  sourceDocumentRecordSchema,
  statEventRecordSchema,
} from '@/data/schemas';
import type { ProjectFixtureBundle } from '@/data/repositories/synthetic/projects/bundle';
import { SETY_2026 } from '@/data/repositories/synthetic/projects/sety-2026';
import { AI_OPS_RETAINER } from '@/data/repositories/synthetic/projects/ai-ops-retainer';
import { EVEN_INTERNAL_2026 } from '@/data/repositories/synthetic/projects/even-internal-2026';
import type {
  AiContractDraft,
  AllocationRuleVersion,
  Assignment,
  CashEvent,
  EvidenceLink,
  Member,
  MemberProfile,
  MemberSkill,
  MilestoneTemplate,
  Opportunity,
  OpportunityMilestone,
  Organization,
  PortfolioItem,
  Project,
  ServiceVersion,
  Settlement,
  SettlementLine,
  SettlementLinePayout,
  Skill,
  SourceDocument,
  StatEvent,
} from '@/types/domain';

import organizationsRaw from '@/data/fixtures/organizations.json';
import membersRaw from '@/data/fixtures/members.json';
import memberProfilesRaw from '@/data/fixtures/member-profiles.json';
import skillsRaw from '@/data/fixtures/skills.json';
import memberSkillsRaw from '@/data/fixtures/member-skills.json';
import portfolioItemsRaw from '@/data/fixtures/portfolio-items.json';
import statEventsRaw from '@/data/fixtures/stat-events.json';
import sourceDocumentsRaw from '@/data/fixtures/source-documents.json';
import aiContractDraftsRaw from '@/data/fixtures/ai-contract-drafts.json';

const PROJECT_BUNDLES: readonly ProjectFixtureBundle[] = [
  SETY_2026,
  AI_OPS_RETAINER,
  EVEN_INTERNAL_2026,
];

export interface SyntheticDataset {
  readonly organizations: ReadonlyMap<string, Organization>;
  readonly members: ReadonlyMap<string, Member>;
  readonly memberProfiles: ReadonlyMap<string, MemberProfile>;
  readonly skills: ReadonlyMap<string, Skill>;
  readonly memberSkills: readonly MemberSkill[];
  readonly portfolioItems: readonly PortfolioItem[];
  readonly statEvents: readonly StatEvent[];
  readonly projects: ReadonlyMap<string, Project>;
  readonly serviceVersions: ReadonlyMap<string, ServiceVersion>;
  readonly allocationRuleVersions: ReadonlyMap<string, AllocationRuleVersion>;
  readonly milestoneTemplates: readonly MilestoneTemplate[];
  readonly opportunities: readonly Opportunity[];
  readonly assignments: readonly Assignment[];
  readonly opportunityMilestones: readonly OpportunityMilestone[];
  readonly evidenceLinks: readonly EvidenceLink[];
  readonly cashEvents: readonly CashEvent[];
  readonly settlements: readonly Settlement[];
  readonly settlementLines: readonly SettlementLine[];
  readonly settlementLinePayouts: readonly SettlementLinePayout[];
  readonly sourceDocuments: ReadonlyMap<string, SourceDocument>;
  readonly aiContractDrafts: ReadonlyMap<string, AiContractDraft>;
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
  const memberProfiles: MemberProfile[] = parseFixture(
    'member-profiles',
    memberProfileRecordSchema,
    memberProfilesRaw,
  );
  const skills: Skill[] = parseFixture('skills', skillRecordSchema, skillsRaw);
  const memberSkills: MemberSkill[] = parseFixture(
    'member-skills',
    memberSkillRecordSchema,
    memberSkillsRaw,
  );
  const portfolioItems: PortfolioItem[] = parseFixture(
    'portfolio-items',
    portfolioItemRecordSchema,
    portfolioItemsRaw,
  );
  const statEvents: StatEvent[] = parseFixture('stat-events', statEventRecordSchema, statEventsRaw);
  const sourceDocuments: SourceDocument[] = parseFixture(
    'source-documents',
    sourceDocumentRecordSchema,
    sourceDocumentsRaw,
  );
  const aiContractDrafts: AiContractDraft[] = parseFixture(
    'ai-contract-drafts',
    aiContractDraftRecordSchema,
    aiContractDraftsRaw,
  ).map((record) => ({
    ...record,
    currency: assertCurrencyCode(record.currency),
    exampleDistributableBase: {
      value: money(
        record.exampleDistributableBase.amountCentavos,
        assertCurrencyCode(record.exampleDistributableBase.currency),
      ),
      confidence: record.exampleDistributableBase.confidence,
      evidence: record.exampleDistributableBase.evidence,
    },
  }));

  const projects: Project[] = [];
  const serviceVersions: ServiceVersion[] = [];
  const allocationRuleVersions: AllocationRuleVersion[] = [];
  const milestoneTemplates: MilestoneTemplate[] = [];
  const opportunities: Opportunity[] = [];
  const assignments: Assignment[] = [];
  const opportunityMilestones: OpportunityMilestone[] = [];
  const evidenceLinks: EvidenceLink[] = [];
  const cashEvents: CashEvent[] = [];
  const settlements: Settlement[] = [];
  const settlementLines: SettlementLine[] = [];
  const settlementLinePayouts: SettlementLinePayout[] = [];

  for (const bundle of PROJECT_BUNDLES) {
    const at = (file: string) => `projects/${bundle.slug}/${file}`;

    projects.push(
      ...parseFixture(at('project'), projectRecordSchema, bundle.project).map((record) => ({
        ...record,
        currency: assertCurrencyCode(record.currency),
      })),
    );
    serviceVersions.push(
      ...parseFixture(at('service-versions'), serviceVersionRecordSchema, bundle.serviceVersions),
    );
    allocationRuleVersions.push(
      ...parseFixture(
        at('allocation-rule-versions'),
        allocationRuleVersionRecordSchema,
        bundle.allocationRuleVersions,
      ).map((record) => ({
        ...record,
        currency: assertCurrencyCode(record.currency),
        shares: record.shares.map((share) => ({
          ...share,
          weightBp: basisPoints(share.weightBp),
        })),
      })),
    );
    milestoneTemplates.push(
      ...parseFixture(
        at('milestone-templates'),
        milestoneTemplateRecordSchema,
        bundle.milestoneTemplates,
      ),
    );
    opportunities.push(
      ...parseFixture(at('opportunities'), opportunityRecordSchema, bundle.opportunities),
    );
    assignments.push(
      ...parseFixture(at('assignments'), assignmentRecordSchema, bundle.assignments).map(
        (record) => ({ ...record, weightBp: basisPoints(record.weightBp) }),
      ),
    );
    opportunityMilestones.push(
      ...parseFixture(
        at('opportunity-milestones'),
        opportunityMilestoneRecordSchema,
        bundle.opportunityMilestones,
      ),
    );
    evidenceLinks.push(
      ...parseFixture(at('evidence-links'), evidenceLinkRecordSchema, bundle.evidenceLinks),
    );
    cashEvents.push(
      ...parseFixture(at('cash-events'), cashEventRecordSchema, bundle.cashEvents).map(
        ({ amountCentavos, currency, ...rest }) => ({
          ...rest,
          amount: money(amountCentavos, assertCurrencyCode(currency)),
        }),
      ),
    );
    settlements.push(
      ...parseFixture(at('settlements'), settlementRecordSchema, bundle.settlements).map(
        ({ baseCentavos, currency, ...rest }) => ({
          ...rest,
          base: money(baseCentavos, assertCurrencyCode(currency)),
        }),
      ),
    );
    settlementLines.push(
      ...parseFixture(
        at('settlement-lines'),
        settlementLineRecordSchema,
        bundle.settlementLines,
      ).map(({ amountCentavos, currency, weightBp, ...rest }) => ({
        ...rest,
        weightBp: basisPoints(weightBp),
        amount: money(amountCentavos, assertCurrencyCode(currency)),
      })),
    );
    settlementLinePayouts.push(
      ...parseFixture(
        at('settlement-line-payouts'),
        settlementLinePayoutRecordSchema,
        bundle.settlementLinePayouts,
      ).map(({ amountCentavos, currency, ...rest }) => ({
        ...rest,
        amount: money(amountCentavos, assertCurrencyCode(currency)),
      })),
    );
  }

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
    memberProfiles: new Map(memberProfiles.map((profile) => [profile.memberId, profile])),
    skills: byId(skills),
    memberSkills,
    portfolioItems,
    statEvents,
    projects: byId(projects),
    serviceVersions: byId(serviceVersions),
    allocationRuleVersions: byId(allocationRuleVersions),
    milestoneTemplates,
    opportunities,
    assignments,
    opportunityMilestones,
    evidenceLinks,
    cashEvents,
    settlements,
    settlementLines,
    settlementLinePayouts,
    sourceDocuments: byId(sourceDocuments),
    aiContractDrafts: byId(aiContractDrafts),
  };
}

let cache: SyntheticDataset | undefined;

export function loadSyntheticDataset(): SyntheticDataset {
  cache ??= build();
  return cache;
}
