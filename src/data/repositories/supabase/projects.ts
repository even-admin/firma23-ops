/**
 * Supabase-backed project repository.
 *
 * Second adapter after intake, written to prove the pattern established
 * there generalizes: RLS-respecting queries through the server client,
 * mapped into the exact same view models the synthetic adapter produces.
 * Not wired into any route yet — see the session handoff for why the
 * remaining read repositories (opportunities, members, leaderboard, finance,
 * settlements) are deferred rather than rushed out unverified.
 */

import { money, sumMoney, zeroMoney, type CurrencyCode } from '@/lib/money';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ViewerContext } from '@/lib/viewer';
import type { ProjectRepository } from '@/data/repositories/projects';
import type { ProjectStatus } from '@/types/domain';
import type { ProjectDetail, ProjectRuleView, ProjectSummary } from '@/types/views';

interface ProjectRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly sponsor_name: string;
  readonly status: ProjectStatus;
  readonly currency: CurrencyCode;
  readonly active_allocation_rule_version_id: string | null;
}

interface RuleVersionRow {
  readonly id: string;
  readonly project_id: string;
  readonly version: number;
  readonly effective_from: string;
  readonly base_policy: { label: string; note: string };
  readonly allocation_shares: readonly { key: string; label: string; weight_bp: number }[];
}

function toRuleView(row: RuleVersionRow): ProjectRuleView {
  return {
    id: row.id,
    version: row.version,
    effectiveFrom: row.effective_from,
    basePolicyLabel: row.base_policy.label,
    basePolicyNote: row.base_policy.note,
    shares: row.allocation_shares.map((share) => ({
      key: share.key,
      label: share.label,
      weightBp: share.weight_bp as never,
    })),
  };
}

async function summarise(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  project: ProjectRow,
): Promise<ProjectSummary> {
  const [servicesResult, opportunitiesResult, ruleResult] = await Promise.all([
    client
      .from('service_versions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id),
    client.from('opportunities').select('id').eq('project_id', project.id),
    project.active_allocation_rule_version_id === null
      ? Promise.resolve({ data: null })
      : client
          .from('allocation_rule_versions')
          .select('id, project_id, version, effective_from, base_policy, allocation_shares(key, label, weight_bp)')
          .eq('id', project.active_allocation_rule_version_id)
          .single(),
  ]);

  const opportunityIds = ((opportunitiesResult.data ?? []) as readonly { id: string }[]).map(
    (row) => row.id,
  );

  const approvedSettled =
    opportunityIds.length === 0
      ? zeroMoney(project.currency)
      : await (async () => {
          const settlementsResult = await client
            .from('settlements')
            .select('base_centavos, currency')
            .eq('status', 'approved')
            .in('opportunity_id', opportunityIds);
          const rows = (settlementsResult.data ?? []) as readonly {
            base_centavos: number;
            currency: CurrencyCode;
          }[];
          return rows.length === 0
            ? zeroMoney(project.currency)
            : sumMoney(rows.map((row) => money(row.base_centavos, row.currency)), project.currency);
        })();

  const activeRule = ruleResult.data === null ? null : toRuleView(ruleResult.data as RuleVersionRow);

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    sponsorName: project.sponsor_name,
    status: project.status,
    serviceCount: servicesResult.count ?? 0,
    opportunityCount: opportunityIds.length,
    activeRule,
    approvedSettled,
  };
}

export const supabaseProjectRepository: ProjectRepository = {
  async list(viewer: ViewerContext): Promise<ProjectSummary[]> {
    const client = await createSupabaseServerClient();
    if (client === null) return [];

    const result = await client
      .from('projects')
      .select('id, slug, name, sponsor_name, status, currency, active_allocation_rule_version_id')
      .eq('org_id', viewer.orgId);
    if (result.error !== null) throw new Error(result.error.message);

    const rows = (result.data ?? []) as readonly ProjectRow[];
    return Promise.all(rows.map((row) => summarise(client, row)));
  },

  async getBySlug(slug: string, viewer: ViewerContext): Promise<ProjectDetail | null> {
    const client = await createSupabaseServerClient();
    if (client === null) return null;

    const projectResult = await client
      .from('projects')
      .select('id, slug, name, sponsor_name, status, currency, active_allocation_rule_version_id')
      .eq('org_id', viewer.orgId)
      .eq('slug', slug)
      .maybeSingle();
    if (projectResult.error !== null) throw new Error(projectResult.error.message);
    const project = projectResult.data as ProjectRow | null;
    if (project === null) return null;

    const [servicesResult, rulesResult, opportunitiesResult] = await Promise.all([
      client
        .from('service_versions')
        .select('id, name, version, deliverables_summary')
        .eq('project_id', project.id),
      client
        .from('allocation_rule_versions')
        .select('id, project_id, version, effective_from, base_policy, allocation_shares(key, label, weight_bp)')
        .eq('project_id', project.id),
      client
        .from('opportunities')
        .select('id, code, beneficiary_name, beneficiary_location, status, opened_at, service_version_id, allocation_rule_version_id')
        .eq('project_id', project.id),
    ]);

    const serviceRows = (servicesResult.data ?? []) as readonly {
      id: string;
      name: string;
      version: number;
      deliverables_summary: string;
    }[];

    const milestoneCountsResult =
      serviceRows.length === 0
        ? { data: [] }
        : await client
            .from('milestone_templates')
            .select('service_version_id')
            .in('service_version_id', serviceRows.map((row) => row.id));
    const milestoneCountsBySv = new Map<string, number>();
    for (const row of (milestoneCountsResult.data ?? []) as readonly { service_version_id: string }[]) {
      milestoneCountsBySv.set(row.service_version_id, (milestoneCountsBySv.get(row.service_version_id) ?? 0) + 1);
    }

    const services = serviceRows.map((row) => ({
      id: row.id,
      name: row.name,
      version: row.version,
      deliverablesSummary: row.deliverables_summary,
      milestoneCount: milestoneCountsBySv.get(row.id) ?? 0,
    }));

    const rules = ((rulesResult.data ?? []) as readonly RuleVersionRow[]).map(toRuleView);

    const opportunityRows = (opportunitiesResult.data ?? []) as readonly {
      id: string;
      code: string;
      beneficiary_name: string;
      beneficiary_location: string;
      status: string;
      opened_at: string;
      service_version_id: string;
      allocation_rule_version_id: string;
    }[];

    const serviceNameById = new Map(serviceRows.map((row) => [row.id, row]));

    const opportunities = opportunityRows.map((row) => {
      const service = serviceNameById.get(row.service_version_id);
      return {
        id: row.id,
        code: row.code,
        beneficiaryName: row.beneficiary_name,
        beneficiaryLocation: row.beneficiary_location,
        status: row.status as ProjectDetail['opportunities'][number]['status'],
        projectName: project.name,
        projectSlug: project.slug,
        serviceName: service?.name ?? '',
        serviceVersion: service?.version ?? 0,
        openedAt: row.opened_at,
      };
    });

    const summary = await summarise(client, project);
    return { ...summary, services, rules, opportunities };
  },
};
