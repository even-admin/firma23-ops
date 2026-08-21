import { sumMoney, zeroMoney } from '@/lib/money';
import type { ViewerContext } from '@/lib/viewer';
import type { ProjectRepository } from '@/data/repositories/projects';
import { loadSyntheticDataset, type SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { summariseOpportunity } from '@/data/repositories/synthetic/rails';
import type { AllocationRuleVersion, Project } from '@/types/domain';
import type { ProjectDetail, ProjectRuleView, ProjectSummary } from '@/types/views';

function toRuleView(rule: AllocationRuleVersion): ProjectRuleView {
  return {
    id: rule.id,
    version: rule.version,
    effectiveFrom: rule.effectiveFrom,
    basePolicyLabel: rule.basePolicy.label,
    basePolicyNote: rule.basePolicy.note,
    shares: rule.shares.map((share) => ({
      key: share.key,
      label: share.label,
      weightBp: share.weightBp,
    })),
  };
}

function summarise(dataset: SyntheticDataset, project: Project): ProjectSummary {
  const services = [...dataset.serviceVersions.values()].filter(
    (service) => service.projectId === project.id,
  );
  const opportunities = dataset.opportunities.filter(
    (opportunity) => opportunity.projectId === project.id,
  );
  const activeRule =
    project.activeAllocationRuleVersionId === null
      ? null
      : dataset.allocationRuleVersions.get(project.activeAllocationRuleVersionId);

  // Approved settlements only. A project total never includes a projection.
  const opportunityIds = new Set(opportunities.map((entry) => entry.id));
  const approvedSettlements = dataset.settlements.filter(
    (settlement) =>
      settlement.status === 'approved' && opportunityIds.has(settlement.opportunityId),
  );

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    sponsorName: project.sponsorName,
    status: project.status,
    serviceCount: services.length,
    opportunityCount: opportunities.length,
    activeRule: activeRule === undefined || activeRule === null ? null : toRuleView(activeRule),
    approvedSettled:
      approvedSettlements.length === 0
        ? zeroMoney(project.currency)
        : sumMoney(
            approvedSettlements.map((settlement) => settlement.base),
            project.currency,
          ),
  };
}

export const syntheticProjectRepository: ProjectRepository = {
  async list(_viewer: ViewerContext): Promise<ProjectSummary[]> {
    const dataset = loadSyntheticDataset();
    return [...dataset.projects.values()].map((project) => summarise(dataset, project));
  },

  async getBySlug(slug: string, _viewer: ViewerContext): Promise<ProjectDetail | null> {
    const dataset = loadSyntheticDataset();
    const project = [...dataset.projects.values()].find((entry) => entry.slug === slug);
    if (project === undefined) return null;

    const services = [...dataset.serviceVersions.values()]
      .filter((service) => service.projectId === project.id)
      .map((service) => ({
        id: service.id,
        name: service.name,
        version: service.version,
        deliverablesSummary: service.deliverablesSummary,
        milestoneCount: dataset.milestoneTemplates.filter(
          (template) => template.serviceVersionId === service.id,
        ).length,
      }));

    const rules = [...dataset.allocationRuleVersions.values()]
      .filter((rule) => rule.projectId === project.id)
      .map(toRuleView);

    const opportunities = dataset.opportunities
      .filter((opportunity) => opportunity.projectId === project.id)
      .map((opportunity) => summariseOpportunity(dataset, opportunity));

    return { ...summarise(dataset, project), services, rules, opportunities };
  },
};
