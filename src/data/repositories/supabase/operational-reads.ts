import {
  buildApprovedSettlement,
  resolveAllocation,
  resolveDistributableBase,
  totalCashReceived,
  type DistributableBase,
  type RailModel,
} from '@/lib/allocation';
import {
  basisPoints,
  money,
  sumMoney,
  zeroMoney,
  reconcileApprovedAndPaid,
  assertCurrencyCode,
  type Money,
} from '@/lib/money';
import { DataError } from '@/lib/result';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ViewerContext } from '@/lib/viewer';
import { copy } from '@/copy/es-MX';
import type {
  AllocationRuleVersion,
  Assignment,
  BasePolicy,
  CashEvent,
  Member,
  Organization,
  Project,
  Settlement,
  SettlementLine,
  SettlementLinePayout,
  StatEvent,
} from '@/types/domain';
import type {
  AssignmentView,
  CashEventView,
  FinanceOverview,
  FinanceRow,
  HomeAssignment,
  HomePerformanceHistory,
  MemberMoney,
  OpportunityDetail,
  OpportunitySummary,
  OperatorCardView,
  OperatorProfile,
  PoolWeightView,
  ProjectDetail,
  ProjectRuleView,
  ProjectServiceView,
  ProjectSummary,
  SettlementPreview,
} from '@/types/views';
import { deriveMemberStats } from '@/lib/stats';

type Client = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type PortfolioRow = OperatorProfile['portfolio'][number] & { readonly memberId: string };

export interface OperationalSnapshot {
  readonly organizations: ReadonlyMap<string, Organization>;
  readonly members: ReadonlyMap<string, Member>;
  readonly projects: ReadonlyMap<string, Project>;
  readonly services: readonly {
    readonly id: string;
    readonly projectId: string;
    readonly key: string;
    readonly name: string;
    readonly version: number;
    readonly deliverablesSummary: string;
  }[];
  readonly rules: ReadonlyMap<string, AllocationRuleVersion>;
  readonly opportunities: readonly {
    readonly id: string;
    readonly projectId: string;
    readonly serviceVersionId: string;
    readonly allocationRuleVersionId: string;
    readonly code: string;
    readonly beneficiaryName: string;
    readonly beneficiaryLocation: string;
    readonly status: OpportunitySummary['status'];
    readonly openedAt: string;
  }[];
  readonly assignments: readonly Assignment[];
  readonly projections: readonly {
    readonly opportunityId: string;
    readonly version: number;
    readonly base: Money;
  }[];
  readonly cashEvents: readonly CashEvent[];
  readonly settlements: readonly Settlement[];
  readonly settlementLines: readonly SettlementLine[];
  readonly payouts: readonly SettlementLinePayout[];
  /** Member-only RPC output; it contains calculated shares, never raw projection bases. */
  readonly memberFinancials: ReadonlyMap<string, {
    readonly projected: Money;
    readonly approved: Money;
    readonly paid: Money;
    readonly owed: Money;
    readonly recovery: Money;
    readonly correctionRequired: boolean;
  }>;
  readonly profiles: ReadonlyMap<string, { bio: string; availability: OperatorCardView['availability']; nextCapability: string; joinedAt: string }>;
  readonly skills: readonly { id: string; name: string; family: string }[];
  readonly memberSkills: readonly { memberId: string; skillId: string; level: OperatorCardView['skills'][number]['level']; verification: OperatorCardView['skills'][number]['verification'] }[];
  readonly portfolioItems: readonly PortfolioRow[];
  readonly statEvents: readonly StatEvent[];
}

function requireClient(client: Client | null): Client {
  if (client === null) throw new Error(copy.finance.writeBlockedReason);
  return client;
}

function toBasePolicy(value: unknown): BasePolicy {
  const raw = value as { kind?: string; includeTypes?: string[]; label?: string; note?: string };
  if (raw.kind !== 'cash_event_types' || !Array.isArray(raw.includeTypes)) {
    throw new DataError('Allocation rule has an unsupported base policy');
  }
  return {
    kind: 'cash_event_types',
    includeTypes: raw.includeTypes as BasePolicy['includeTypes'],
    label: raw.label ?? '',
    note: raw.note ?? '',
  };
}

function summaryFor(snapshot: OperationalSnapshot, opportunity: OperationalSnapshot['opportunities'][number]): OpportunitySummary {
  const project = snapshot.projects.get(opportunity.projectId);
  const service = snapshot.services.find((row) => row.id === opportunity.serviceVersionId);
  if (project === undefined || service === undefined) {
    throw new DataError(`Opportunity ${opportunity.id} references missing project/service`);
  }
  return {
    id: opportunity.id,
    code: opportunity.code,
    beneficiaryName: opportunity.beneficiaryName,
    beneficiaryLocation: opportunity.beneficiaryLocation,
    status: opportunity.status,
    projectName: project.name,
    projectSlug: project.slug,
    serviceName: service.name,
    serviceVersion: service.version,
    openedAt: opportunity.openedAt,
  };
}

function latestProjection(snapshot: OperationalSnapshot, opportunityId: string): Money | null {
  const row = snapshot.projections
    .filter((entry) => entry.opportunityId === opportunityId)
    .sort((a, b) => b.version - a.version)[0];
  return row?.base ?? null;
}

function activeSettlement(snapshot: OperationalSnapshot, opportunityId: string): Settlement | null {
  const candidates = snapshot.settlements.filter((row) => row.opportunityId === opportunityId);
  const reversed = new Set(
    candidates
      .filter((row) => row.status === 'approved' && row.kind === 'reversal')
      .map((row) => row.correctsSettlementId),
  );
  return (
    candidates.find(
      (row) => row.status === 'approved' && row.kind === 'original' && !reversed.has(row.id),
    ) ?? null
  );
}

function distributableBaseFor(
  snapshot: OperationalSnapshot,
  rule: AllocationRuleVersion,
  opportunityId: string,
): DistributableBase {
  return resolveDistributableBase(
    rule.basePolicy,
    snapshot.cashEvents.filter((event) => event.opportunityId === opportunityId),
    rule.currency,
  );
}

function correctionFor(snapshot: OperationalSnapshot, opportunityId: string): RailModel | null {
  const reversal = snapshot.settlements.find(
    (row) => row.opportunityId === opportunityId && row.status === 'approved' && row.kind === 'reversal',
  );
  if (reversal === undefined || activeSettlement(snapshot, opportunityId) !== null) return null;
  const rule = snapshot.rules.get(reversal.allocationRuleVersionId);
  if (rule === undefined || reversal.correctsSettlementId === null || reversal.approvedAt === null) return null;
  return {
    kind: 'correction_required',
    reversedSettlementId: reversal.correctsSettlementId,
    reversalSettlementId: reversal.id,
    ruleVersionId: rule.id,
    ruleVersion: rule.version,
    reversedAt: reversal.approvedAt,
  };
}

function railFor(snapshot: OperationalSnapshot, opportunity: OperationalSnapshot['opportunities'][number]): {
  readonly rail: RailModel;
  readonly base: DistributableBase;
  readonly projectedBase: Money;
  readonly cashReceived: Money;
} {
  const rule = snapshot.rules.get(opportunity.allocationRuleVersionId);
  if (rule === undefined) throw new DataError(`Opportunity ${opportunity.id} has no rule`);
  const settlement = activeSettlement(snapshot, opportunity.id);
  const cashEvents = snapshot.cashEvents.filter((row) => row.opportunityId === opportunity.id);
  const cashReceived = totalCashReceived(cashEvents, rule.currency);

  if (settlement !== null) {
    const approver = settlement.approvedByMemberId === null ? undefined : snapshot.members.get(settlement.approvedByMemberId);
    if (approver === undefined) throw new DataError(`Settlement ${settlement.id} has no approver`);
    const lines = snapshot.settlementLines.filter((line) => line.settlementId === settlement.id);
    const lineIds = new Set(lines.map((line) => line.id));
    return {
      rail: buildApprovedSettlement({
        settlement,
        lines,
        payouts: snapshot.payouts.filter((payout) => lineIds.has(payout.settlementLineId)),
        ruleVersion: rule,
        basePolicyLabel: rule.basePolicy.label,
        approver,
      }),
      base: {
        base: settlement.base,
        policyLabel: rule.basePolicy.label,
        policyNote: rule.basePolicy.note,
        included: cashEvents.filter((event) => rule.basePolicy.includeTypes.includes(event.type)),
        excluded: cashEvents.filter((event) => !rule.basePolicy.includeTypes.includes(event.type)),
      },
      projectedBase: zeroMoney(rule.currency),
      cashReceived,
    };
  }

  const base = distributableBaseFor(snapshot, rule, opportunity.id);
  const correction = correctionFor(snapshot, opportunity.id);
  const projectedBase = correction === null ? latestProjection(snapshot, opportunity.id) ?? zeroMoney(rule.currency) : zeroMoney(rule.currency);
  return {
    rail: correction ?? resolveAllocation({
      ruleVersion: rule,
      base: projectedBase,
      basePolicyLabel: copy.money.projectedLong,
      assignments: snapshot.assignments.filter((row) => row.opportunityId === opportunity.id),
      members: snapshot.members,
      organizations: snapshot.organizations,
      unassignedLabel: copy.money.unassigned,
    }),
    base,
    projectedBase,
    cashReceived,
  };
}

function cashEventViews(snapshot: OperationalSnapshot, opportunityId: string, rule: AllocationRuleVersion): CashEventView[] {
  return snapshot.cashEvents
    .filter((event) => event.opportunityId === opportunityId)
    .map((event) => ({
      id: event.id,
      type: event.type,
      label: event.label,
      amount: event.amount,
      occurredAt: event.occurredAt,
      countsTowardBase: rule.basePolicy.includeTypes.includes(event.type),
    }));
}

function poolWeightViews(rule: AllocationRuleVersion, assignments: readonly { readonly roleKey: string; readonly weightBp: number }[]): PoolWeightView[] {
  return rule.shares
    .filter((share) => share.recipientBehavior === 'member_pool')
    .map((share) => {
      const totalBp = assignments
        .filter((assignment) => assignment.roleKey === share.key)
        .reduce((total, assignment) => total + assignment.weightBp, 0);
      return { key: share.key, label: share.label, totalBp, balanced: totalBp === 10_000 };
    });
}

function settlementBalances(snapshot: OperationalSnapshot) {
  return snapshot.settlementLines
    .filter((line) => {
      const settlement = snapshot.settlements.find((entry) => entry.id === line.settlementId);
      return settlement?.kind === 'original' && settlement.status === 'approved';
    })
    .map((line) => {
      const settlement = snapshot.settlements.find((entry) => entry.id === line.settlementId);
      if (settlement === undefined) throw new DataError(`Missing settlement for line ${line.id}`);
      const active = activeSettlement(snapshot, settlement.opportunityId)?.id === settlement.id;
      const paid = sumMoney(snapshot.payouts.filter((payout) => payout.settlementLineId === line.id).map((payout) => payout.amount), line.amount.currency);
      const currentApproved = active ? line.amount : zeroMoney(line.amount.currency);
      const reconciliation = reconcileApprovedAndPaid(currentApproved, paid);
      return { line, opportunityId: settlement.opportunityId, paid, owed: reconciliation.owed, recovery: reconciliation.recovery };
    });
}

function unavailablePerformance(moneyState: MemberMoney): HomePerformanceHistory {
  return {
    asOf: new Date().toISOString(),
    series: [
      { kind: 'money', key: 'approved', current: moneyState.approved, historyAvailability: 'unavailable', points: [] },
      { kind: 'money', key: 'paid', current: moneyState.paid, historyAvailability: 'unavailable', points: [] },
      { kind: 'money', key: 'approved_unpaid', current: moneyState.approvedUnpaid, historyAvailability: 'unavailable', points: [] },
      { kind: 'money', key: 'projected', current: moneyState.projected, historyAvailability: 'unavailable', points: [] },
      { kind: 'count', key: 'closed', current: 0, historyAvailability: 'available', points: [] },
    ],
  };
}

export async function loadOperationalSnapshot(viewer: ViewerContext): Promise<OperationalSnapshot> {
  const client = requireClient(await createSupabaseServerClient());

  const [
    organizations,
    members,
    profiles,
    skills,
    memberSkills,
    portfolioItems,
    projects,
    services,
    rules,
    shares,
    opportunities,
    assignments,
    projections,
    cashEvents,
    settlements,
    settlementLines,
    payouts,
    statEvents,
    memberFinancials,
  ] = await Promise.all([
    client.from('organizations').select('id, slug, name').eq('id', viewer.orgId),
    client.from('members').select('id, org_id, slug, display_name, initials, role').eq('org_id', viewer.orgId),
    client.from('member_profiles').select('member_id, bio, availability, next_capability, joined_at'),
    client.from('skills').select('id, name, family'),
    client.from('member_skills').select('member_id, skill_id, level, verification'),
    client.from('portfolio_items').select('id, member_id, title, role_label, url, kind, verification, completed_at'),
    client.from('projects').select('id, org_id, slug, name, sponsor_name, status, currency, active_allocation_rule_version_id').eq('org_id', viewer.orgId),
    client.from('service_versions').select('id, project_id, key, name, version, deliverables_summary'),
    client.from('allocation_rule_versions').select('id, project_id, version, effective_from, currency, base_policy'),
    client.from('allocation_shares').select('rule_version_id, key, recipient_behavior, label, weight_bp, recipient_org_id'),
    client.from('opportunities').select('id, project_id, service_version_id, allocation_rule_version_id, code, beneficiary_name, beneficiary_location, status, opened_at'),
    client.from('assignments').select('id, opportunity_id, member_id, role_key, role_label, weight_bp, status'),
    client.from('opportunity_projection_versions').select('opportunity_id, version, projected_base_centavos, currency'),
    client.from('cash_events').select('id, opportunity_id, type, label, amount_centavos, currency, occurred_at'),
    client.from('settlements').select('id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id'),
    client.from('settlement_lines').select('id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence'),
    client.from('settlement_line_payouts').select('id, settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_at, created_by_member_id, idempotency_key'),
    client.from('stat_events').select('id, member_id, opportunity_id, metric_key, quantity, source_kind, source_id, reverses_stat_event_id, occurred_at'),
    viewer.role === 'member'
      ? client.rpc('member_opportunity_financials')
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [organizations, members, profiles, skills, memberSkills, portfolioItems, projects, services, rules, shares, opportunities, assignments, projections, cashEvents, settlements, settlementLines, payouts, statEvents, memberFinancials]) {
    if (result.error !== null) throw new Error(result.error.message);
  }

  const orgMap = new Map<string, Organization>(
    ((organizations.data ?? []) as { id: string; slug: string; name: string }[]).map((row) => [
      row.id,
      { id: row.id, slug: row.slug, name: row.name },
    ]),
  );
  const memberMap = new Map<string, Member>(
    ((members.data ?? []) as { id: string; org_id: string; slug: string; display_name: string; initials: string; role: Member['role'] }[]).map((row) => [
      row.id,
      { id: row.id, orgId: row.org_id, slug: row.slug, displayName: row.display_name, initials: row.initials, role: row.role },
    ]),
  );
  const projectMap = new Map<string, Project>(
    ((projects.data ?? []) as { id: string; org_id: string; slug: string; name: string; sponsor_name: string; status: Project['status']; currency: string; active_allocation_rule_version_id: string | null }[]).map((row) => [
      row.id,
      {
        id: row.id,
        orgId: row.org_id,
        slug: row.slug,
        name: row.name,
        sponsorName: row.sponsor_name,
        status: row.status,
        currency: assertCurrencyCode(row.currency),
        activeAllocationRuleVersionId: row.active_allocation_rule_version_id,
      },
    ]),
  );

  const shareRows = (shares.data ?? []) as {
    rule_version_id: string;
    key: string;
    recipient_behavior: AllocationRuleVersion['shares'][number]['recipientBehavior'];
    label: string;
    weight_bp: number;
    recipient_org_id: string | null;
  }[];
  const ruleMap = new Map<string, AllocationRuleVersion>(
    ((rules.data ?? []) as { id: string; project_id: string; version: number; effective_from: string; currency: string; base_policy: unknown }[]).map((row) => [
      row.id,
      {
        id: row.id,
        projectId: row.project_id,
        version: row.version,
        effectiveFrom: row.effective_from,
        currency: assertCurrencyCode(row.currency),
        basePolicy: toBasePolicy(row.base_policy),
        immutable: true,
        shares: shareRows
          .filter((share) => share.rule_version_id === row.id)
          .map((share) => ({
            key: share.key,
            recipientBehavior: share.recipient_behavior,
            label: share.label,
            weightBp: basisPoints(share.weight_bp),
            recipientOrgId: share.recipient_org_id,
          })),
      },
    ]),
  );

  return {
    organizations: orgMap,
    members: memberMap,
    projects: projectMap,
    services: ((services.data ?? []) as { id: string; project_id: string; key: string; name: string; version: number; deliverables_summary: string }[]).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      key: row.key,
      name: row.name,
      version: row.version,
      deliverablesSummary: row.deliverables_summary,
    })),
    rules: ruleMap,
    opportunities: ((opportunities.data ?? []) as { id: string; project_id: string; service_version_id: string; allocation_rule_version_id: string; code: string; beneficiary_name: string; beneficiary_location: string; status: OpportunitySummary['status']; opened_at: string }[]).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      serviceVersionId: row.service_version_id,
      allocationRuleVersionId: row.allocation_rule_version_id,
      code: row.code,
      beneficiaryName: row.beneficiary_name,
      beneficiaryLocation: row.beneficiary_location,
      status: row.status,
      openedAt: row.opened_at,
    })),
    assignments: ((assignments.data ?? []) as { id: string; opportunity_id: string; member_id: string; role_key: string; role_label: string; weight_bp: number; status: Assignment['status'] }[]).map((row) => ({
      id: row.id,
      opportunityId: row.opportunity_id,
      memberId: row.member_id,
      roleKey: row.role_key,
      roleLabel: row.role_label,
      weightBp: basisPoints(row.weight_bp),
      status: row.status,
    })),
    projections: ((projections.data ?? []) as { opportunity_id: string; version: number; projected_base_centavos: number; currency: string }[]).map((row) => ({
      opportunityId: row.opportunity_id,
      version: row.version,
      base: money(row.projected_base_centavos, assertCurrencyCode(row.currency)),
    })),
    cashEvents: ((cashEvents.data ?? []) as { id: string; opportunity_id: string; type: CashEvent['type']; label: string; amount_centavos: number; currency: string; occurred_at: string }[]).map((row) => ({
      id: row.id,
      opportunityId: row.opportunity_id,
      type: row.type,
      label: row.label,
      amount: money(row.amount_centavos, assertCurrencyCode(row.currency)),
      occurredAt: row.occurred_at,
    })),
    settlements: ((settlements.data ?? []) as { id: string; opportunity_id: string; allocation_rule_version_id: string; status: Settlement['status']; kind: Settlement['kind']; corrects_settlement_id: string | null; base_centavos: number; currency: string; approved_at: string | null; approved_by_member_id: string | null }[]).map((row) => ({
      id: row.id,
      opportunityId: row.opportunity_id,
      allocationRuleVersionId: row.allocation_rule_version_id,
      status: row.status,
      kind: row.kind,
      correctsSettlementId: row.corrects_settlement_id,
      base: money(row.base_centavos, assertCurrencyCode(row.currency)),
      approvedAt: row.approved_at,
      approvedByMemberId: row.approved_by_member_id,
    })),
    settlementLines: ((settlementLines.data ?? []) as { id: string; settlement_id: string; share_key: string; recipient_behavior: SettlementLine['recipientBehavior']; recipient_label: string; member_id: string | null; role_label: string; weight_bp: number; amount_centavos: number; currency: string; sequence: number }[]).map((row) => ({
      id: row.id,
      settlementId: row.settlement_id,
      shareKey: row.share_key,
      recipientBehavior: row.recipient_behavior,
      recipientLabel: row.recipient_label,
      memberId: row.member_id,
      roleLabel: row.role_label,
      weightBp: basisPoints(row.weight_bp),
      amount: money(row.amount_centavos, assertCurrencyCode(row.currency)),
      sequence: row.sequence,
    })),
    payouts: ((payouts.data ?? []) as { id: string; settlement_line_id: string; payout_cash_event_id: string; amount_centavos: number; currency: string; created_at: string; created_by_member_id: string; idempotency_key: string }[]).map((row) => ({
      id: row.id,
      settlementLineId: row.settlement_line_id,
      payoutCashEventId: row.payout_cash_event_id,
      amount: money(row.amount_centavos, assertCurrencyCode(row.currency)),
      createdAt: row.created_at,
      createdByMemberId: row.created_by_member_id,
      idempotencyKey: row.idempotency_key,
    })),
    memberFinancials: new Map(
      ((memberFinancials.data ?? []) as {
        opportunity_id: string;
        currency: string;
        projected_share_centavos: number;
        approved_centavos: number;
        paid_centavos: number;
        owed_centavos: number;
        recovery_centavos: number;
        correction_required: boolean;
      }[]).map((row) => [
        row.opportunity_id,
        {
          projected: money(row.projected_share_centavos, assertCurrencyCode(row.currency)),
          approved: money(row.approved_centavos, assertCurrencyCode(row.currency)),
          paid: money(row.paid_centavos, assertCurrencyCode(row.currency)),
          owed: money(row.owed_centavos, assertCurrencyCode(row.currency)),
          recovery: money(row.recovery_centavos, assertCurrencyCode(row.currency)),
          correctionRequired: row.correction_required,
        },
      ]),
    ),
    profiles: new Map(
      ((profiles.data ?? []) as { member_id: string; bio: string; availability: OperatorCardView['availability']; next_capability: string; joined_at: string }[]).map((row) => [
        row.member_id,
        { bio: row.bio, availability: row.availability, nextCapability: row.next_capability, joinedAt: row.joined_at },
      ]),
    ),
    skills: ((skills.data ?? []) as { id: string; name: string; family: string }[]).map((row) => ({ id: row.id, name: row.name, family: row.family })),
    memberSkills: ((memberSkills.data ?? []) as { member_id: string; skill_id: string; level: OperatorCardView['skills'][number]['level']; verification: OperatorCardView['skills'][number]['verification'] }[]).map((row) => ({
      memberId: row.member_id,
      skillId: row.skill_id,
      level: row.level,
      verification: row.verification,
    })),
    portfolioItems: ((portfolioItems.data ?? []) as { id: string; member_id: string; title: string; role_label: string; url: string; kind: OperatorProfile['portfolio'][number]['kind']; verification: OperatorProfile['portfolio'][number]['verification']; completed_at: string }[]).map((row) => ({
      id: row.id,
      memberId: row.member_id,
      title: row.title,
      roleLabel: row.role_label,
      url: row.url,
      kind: row.kind,
      verification: row.verification,
      completedAt: row.completed_at,
    })),
    statEvents: ((statEvents.data ?? []) as { id: string; member_id: string; opportunity_id: string; metric_key: StatEvent['metricKey']; quantity: number; source_kind: string; source_id: string; reverses_stat_event_id: string | null; occurred_at: string }[]).map((row) => ({
      id: row.id,
      memberId: row.member_id,
      opportunityId: row.opportunity_id,
      metricKey: row.metric_key,
      quantity: row.quantity,
      sourceKind: row.source_kind,
      sourceId: row.source_id,
      reversesStatEventId: row.reverses_stat_event_id,
      occurredAt: row.occurred_at,
    })),
  };
}

export function listProjectSummaries(snapshot: OperationalSnapshot): ProjectSummary[] {
  return [...snapshot.projects.values()].map((project) => {
    const opportunities = snapshot.opportunities.filter((row) => row.projectId === project.id);
    const approved = sumMoney(
      snapshot.settlements
        .filter((settlement) => settlement.status === 'approved' && opportunities.some((opp) => opp.id === settlement.opportunityId))
        .map((settlement) => settlement.base),
      project.currency,
    );
    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      sponsorName: project.sponsorName,
      status: project.status,
      serviceCount: snapshot.services.filter((row) => row.projectId === project.id).length,
      opportunityCount: opportunities.length,
      activeRule: project.activeAllocationRuleVersionId === null ? null : ruleView(snapshot.rules.get(project.activeAllocationRuleVersionId)),
      approvedSettled: approved,
    };
  });
}

function ruleView(rule: AllocationRuleVersion | undefined): ProjectRuleView | null {
  if (rule === undefined) return null;
  return {
    id: rule.id,
    version: rule.version,
    effectiveFrom: rule.effectiveFrom,
    basePolicyLabel: rule.basePolicy.label,
    basePolicyNote: rule.basePolicy.note,
    shares: rule.shares.map((share) => ({ key: share.key, label: share.label, weightBp: share.weightBp })),
  };
}

export function projectDetail(snapshot: OperationalSnapshot, slug: string): ProjectDetail | null {
  const project = [...snapshot.projects.values()].find((row) => row.slug === slug);
  if (project === undefined) return null;
  const services: ProjectServiceView[] = snapshot.services
    .filter((row) => row.projectId === project.id)
    .map((row) => ({ id: row.id, name: row.name, version: row.version, deliverablesSummary: row.deliverablesSummary, milestoneCount: 0 }));
  const summary = listProjectSummaries(snapshot).find((row) => row.id === project.id);
  if (summary === undefined) throw new DataError(`Project ${project.id} summary vanished`);
  return {
    ...summary,
    services,
    rules: [...snapshot.rules.values()].filter((row) => row.projectId === project.id).map((row) => ruleView(row) as ProjectRuleView),
    opportunities: snapshot.opportunities.filter((row) => row.projectId === project.id).map((row) => summaryFor(snapshot, row)),
  };
}

export function opportunityDetail(snapshot: OperationalSnapshot, opportunityId: string): OpportunityDetail | null {
  const opportunity = snapshot.opportunities.find((row) => row.id === opportunityId);
  if (opportunity === undefined) return null;
  const rule = snapshot.rules.get(opportunity.allocationRuleVersionId);
  if (rule === undefined) throw new DataError(`Opportunity ${opportunity.id} has no rule`);
  const built = railFor(snapshot, opportunity);
  const assignments: AssignmentView[] = snapshot.assignments
    .filter((assignment) => assignment.opportunityId === opportunity.id)
    .map((assignment) => {
      const member = snapshot.members.get(assignment.memberId);
      if (member === undefined) throw new DataError(`Assignment ${assignment.id} has no member`);
      return {
        id: assignment.id,
        memberId: member.id,
        memberSlug: member.slug,
        displayName: member.displayName,
        initials: member.initials,
        roleKey: assignment.roleKey,
        roleLabel: assignment.roleLabel,
        weightBp: assignment.weightBp,
        status: assignment.status,
      };
    });
  return {
    summary: summaryFor(snapshot, opportunity),
    rail: built.rail,
    distributableBase: built.base.base,
    basePolicyLabel: built.base.policyLabel,
    basePolicyNote: built.base.policyNote,
    cashReceived: built.cashReceived,
    cashEvents: cashEventViews(snapshot, opportunity.id, rule),
    milestones: [],
    assignments,
    milestonesDone: 0,
    pools: poolWeightViews(rule, assignments),
  };
}

export function financeOverview(snapshot: OperationalSnapshot): FinanceOverview {
  const rows: FinanceRow[] = snapshot.opportunities.map((opportunity) => {
    const built = railFor(snapshot, opportunity);
    const rule = snapshot.rules.get(opportunity.allocationRuleVersionId);
    if (rule === undefined) throw new DataError(`Opportunity ${opportunity.id} has no rule`);
    return {
      opportunity: summaryFor(snapshot, opportunity),
      rail: built.rail,
      distributableBase: built.base.base,
      cashReceived: built.cashReceived,
      cashEvents: cashEventViews(snapshot, opportunity.id, rule),
    };
  });
  const balances = settlementBalances(snapshot);
  const approved = snapshot.settlements
    .filter((row) => row.status === 'approved' && row.kind === 'original' && activeSettlement(snapshot, row.opportunityId)?.id === row.id)
    .map((row) => row.base);
  return {
    totals: {
      cashReceived: sumMoney(rows.map((row) => row.cashReceived)),
      distributableApproved: sumMoney(approved),
      distributableProjected: sumMoney(snapshot.opportunities.map((opportunity) => railFor(snapshot, opportunity).projectedBase)),
      paidOut: sumMoney(balances.map((row) => row.paid)),
      owed: sumMoney(balances.map((row) => row.owed)),
      recovery: sumMoney(balances.map((row) => row.recovery)),
      houseApproved: sumMoney(
        snapshot.settlementLines
          .filter((line) => line.recipientBehavior === 'org_recipient')
          .map((line) => line.amount),
      ),
    },
    rows,
    pendingApprovals: snapshot.settlements.filter((row) => row.status === 'pending').length,
  };
}

export function settlementPreview(snapshot: OperationalSnapshot, opportunityId: string): SettlementPreview | null {
  const detail = opportunityDetail(snapshot, opportunityId);
  if (detail === null) return null;
  return {
    opportunity: detail.summary,
    rail: detail.rail,
    projectedDistributableBase: railFor(snapshot, snapshot.opportunities.find((row) => row.id === opportunityId) as OperationalSnapshot['opportunities'][number]).projectedBase,
    distributableBase: detail.distributableBase,
    cashReceived: detail.cashReceived,
    basePolicyLabel: detail.basePolicyLabel,
    basePolicyNote: detail.basePolicyNote,
    cashEvents: detail.cashEvents,
    pools: detail.pools,
    milestonesOutstanding: detail.milestones.filter((row) => row.status !== 'done').length,
    approvalBlockedReason: copy.settle.blockedInM1,
  };
}

export function memberCards(snapshot: OperationalSnapshot): OperatorCardView[] {
  return [...snapshot.members.values()].map((member) => {
    const profile = snapshot.profiles.get(member.id) ?? {
      bio: '',
      availability: 'limited' as const,
      nextCapability: '',
      joinedAt: '',
    };
    const memberSkills = snapshot.memberSkills
      .filter((row) => row.memberId === member.id)
      .map((entry) => {
        const skill = snapshot.skills.find((row) => row.id === entry.skillId);
        return {
          id: entry.skillId,
          name: skill?.name ?? '',
          family: skill?.family ?? '',
          level: entry.level,
          verification: entry.verification,
        };
      });
    const balances = settlementBalances(snapshot).filter((row) => row.line.memberId === member.id);
    return {
      memberId: member.id,
      slug: member.slug,
      displayName: member.displayName,
      initials: member.initials,
      role: member.role,
      bio: profile.bio,
      availability: profile.availability,
      nextCapability: profile.nextCapability,
      joinedAt: profile.joinedAt,
      skills: memberSkills,
      stats: deriveMemberStats(snapshot.statEvents.filter((event) => event.memberId === member.id)),
      approvedEarnings: sumMoney(
        snapshot.settlementLines
          .filter((line) => line.memberId === member.id && snapshot.settlements.some((settlement) => settlement.id === line.settlementId && settlement.status === 'approved'))
          .map((line) => line.amount),
      ),
      paidEarnings: sumMoney(balances.map((balance) => balance.paid)),
      activeWorkCount: snapshot.assignments.filter((row) => row.memberId === member.id).length,
    };
  });
}

export function personalHome(snapshot: OperationalSnapshot, viewer: ViewerContext) {
  const member = snapshot.members.get(viewer.viewerId);
  if (member === undefined) throw new DataError(`Viewer ${viewer.viewerId} not found`);
  const memberAssignments = snapshot.assignments.filter((assignment) => assignment.memberId === member.id);
  // The member finance RPC is intentionally opportunity-grained to avoid
  // leaking or duplicating line data. Show that one aggregate once when a
  // member holds several roles on the same opportunity.
  const assignmentRows = viewer.role === 'member'
    ? memberAssignments.filter(
        (assignment, index) => memberAssignments.findIndex((entry) => entry.opportunityId === assignment.opportunityId) === index,
      )
    : memberAssignments;
  const assignments: HomeAssignment[] = assignmentRows
    .map((assignment) => {
      const opportunity = snapshot.opportunities.find((row) => row.id === assignment.opportunityId);
      if (opportunity === undefined) throw new DataError(`Assignment ${assignment.id} has no opportunity`);
      const built = railFor(snapshot, opportunity);
      const summary = summaryFor(snapshot, opportunity);
      const privateFinancial = viewer.role === 'member'
        ? snapshot.memberFinancials.get(opportunity.id)
        : undefined;
      const projectedParticipant =
        built.rail.kind === 'projection'
          ? built.rail.segments
              .flatMap((segment) => segment.participants)
              .find((row) => row.key === assignment.id)
          : undefined;
      const settledParticipant =
        built.rail.kind === 'settlement'
          ? built.rail.segments
              .flatMap((segment) => segment.participants)
              .find((row) => row.memberId === member.id && row.roleLabel === assignment.roleLabel)
          : undefined;
      return {
        opportunityId: opportunity.id,
        code: opportunity.code,
        beneficiaryName: opportunity.beneficiaryName,
        beneficiaryLocation: opportunity.beneficiaryLocation,
        projectName: summary.projectName,
        serviceName: summary.serviceName,
        roleLabel:
          viewer.role === 'member'
            ? memberAssignments
                .filter((entry) => entry.opportunityId === opportunity.id)
                .map((entry) => entry.roleLabel)
                .join(' · ')
            : assignment.roleLabel,
        status: opportunity.status,
        active: ['draft', 'assigned', 'in_delivery', 'delivered'].includes(opportunity.status),
        money: privateFinancial?.correctionRequired
          ? { kind: 'correction_required' as const }
          : privateFinancial !== undefined && privateFinancial.approved.amount > 0
            ? { kind: 'approved' as const, amount: privateFinancial.approved, payoutStatus: privateFinancial.paid.amount === 0 ? 'unpaid' as const : privateFinancial.paid.amount === privateFinancial.approved.amount ? 'paid' as const : 'partial' as const }
            : privateFinancial !== undefined && privateFinancial.projected.amount > 0
              ? { kind: 'projected' as const, amount: privateFinancial.projected }
              :
          settledParticipant !== undefined
            ? {
                kind: 'approved' as const,
                amount: settledParticipant.amount,
                payoutStatus: settledParticipant.payoutStatus,
              }
            : built.rail.kind === 'projection'
              ? { kind: 'projected' as const, amount: projectedParticipant?.amount ?? zeroMoney() }
              : { kind: 'correction_required' as const },
      };
    });
  const balances = settlementBalances(snapshot).filter((row) => row.line.memberId === member.id);
  const privateFinancials = [...snapshot.memberFinancials.values()];
  const memberMoney: MemberMoney = {
    approved: viewer.role === 'member'
      ? sumMoney(privateFinancials.map((entry) => entry.approved))
      : sumMoney(
      snapshot.settlementLines
        .filter((line) => line.memberId === member.id && snapshot.settlements.some((settlement) => settlement.id === line.settlementId && settlement.status === 'approved'))
        .map((line) => line.amount),
    ),
    paid: viewer.role === 'member' ? sumMoney(privateFinancials.map((entry) => entry.paid)) : sumMoney(balances.map((balance) => balance.paid)),
    approvedUnpaid: viewer.role === 'member' ? sumMoney(privateFinancials.map((entry) => entry.owed)) : sumMoney(balances.map((balance) => balance.owed)),
    recovery: viewer.role === 'member' ? sumMoney(privateFinancials.map((entry) => entry.recovery)) : sumMoney(balances.map((balance) => balance.recovery)),
    projected: viewer.role === 'member' ? sumMoney(privateFinancials.map((entry) => entry.projected)) : sumMoney(
      assignments.flatMap((row) => (row.money.kind === 'projected' ? [row.money.amount] : [])),
    ),
  };
  return {
    member: { id: member.id, displayName: member.displayName, initials: member.initials, role: member.role },
    money: memberMoney,
    performance: unavailablePerformance(memberMoney),
    activeWorkCount: new Set(
      snapshot.assignments
        .filter((assignment) => assignment.memberId === member.id)
        .map((assignment) => assignment.opportunityId),
    ).size,
    assignments,
    nextActions: assignments
      .filter((assignment) => assignment.active)
      .map((assignment) => ({
        key: `evidence:${assignment.opportunityId}`,
        label: copy.home.actionEvidence,
        detail: `${assignment.code} · ${assignment.beneficiaryName}`,
        tone: 'neutral' as const,
      })),
  };
}

export function poolViewsFor(rule: AllocationRuleVersion, assignments: readonly AssignmentView[]): readonly PoolWeightView[] {
  return poolWeightViews(rule, assignments);
}
