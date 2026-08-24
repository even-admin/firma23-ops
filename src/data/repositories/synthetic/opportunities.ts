import type { ViewerContext } from '@/lib/viewer';
import { assertFounder } from '@/lib/viewer';
import type { OpportunityRepository } from '@/data/repositories/opportunities';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOpportunityRail } from '@/data/repositories/synthetic/rails';
import { cashEventViews, poolWeightViews } from '@/data/repositories/synthetic/shared';
import { DataError } from '@/lib/result';
import type { AssignmentView, EvidenceView, MilestoneView, OpportunityDetail } from '@/types/views';

export const syntheticOpportunityRepository: OpportunityRepository = {
  async getById(opportunityId: string, viewer: ViewerContext): Promise<OpportunityDetail | null> {
    // Line-item financial detail is founder-only in the MVP.
    assertFounder(viewer, 'getOpportunityDetail');

    const dataset = loadSyntheticDataset();
    const opportunity = dataset.opportunities.find((entry) => entry.id === opportunityId);
    if (opportunity === undefined) return null;

    const built = buildOpportunityRail(dataset, opportunity);
    const ruleVersion = dataset.allocationRuleVersions.get(opportunity.allocationRuleVersionId);
    if (ruleVersion === undefined) {
      throw new DataError(`Opportunity ${opportunity.id} references a missing rule version`);
    }

    const milestones: MilestoneView[] = dataset.opportunityMilestones
      .filter((milestone) => milestone.opportunityId === opportunity.id)
      .sort((a, b) => a.position - b.position)
      .map((milestone) => {
        const template = dataset.milestoneTemplates.find(
          (entry) => entry.id === milestone.templateId,
        );
        const owner =
          milestone.assignedMemberId === null
            ? undefined
            : dataset.members.get(milestone.assignedMemberId);
        const evidence: EvidenceView[] = dataset.evidenceLinks
          .filter((link) => link.opportunityMilestoneId === milestone.id)
          .map((link) => ({
            id: link.id,
            label: link.label,
            url: link.url,
            kind: link.kind,
            submittedByName: dataset.members.get(link.submittedByMemberId)?.displayName ?? '',
            submittedAt: link.submittedAt,
          }));

        return {
          id: milestone.id,
          position: milestone.position,
          name: milestone.name,
          description: template?.description ?? '',
          status: milestone.status,
          dueAt: milestone.dueAt,
          completedAt: milestone.completedAt,
          assignedMemberName: owner?.displayName ?? null,
          assignedMemberInitials: owner?.initials ?? null,
          evidence,
        };
      });

    const assignments: AssignmentView[] = dataset.assignments
      .filter((assignment) => assignment.opportunityId === opportunity.id)
      .map((assignment) => {
        const member = dataset.members.get(assignment.memberId);
        if (member === undefined) {
          throw new DataError(`Assignment ${assignment.id} references an unknown member`);
        }
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

    const pools = poolWeightViews(ruleVersion, assignments);

    return {
      summary: built.summary,
      rail: built.rail,
      distributableBase: built.distributableBase.base,
      basePolicyLabel: built.distributableBase.policyLabel,
      basePolicyNote: built.distributableBase.policyNote,
      cashReceived: built.cashReceived,
      cashEvents: cashEventViews(dataset, opportunity.id, ruleVersion.basePolicy.includeTypes),
      milestones,
      assignments,
      milestonesDone: milestones.filter((milestone) => milestone.status === 'done').length,
      pools,
    };
  },
};
