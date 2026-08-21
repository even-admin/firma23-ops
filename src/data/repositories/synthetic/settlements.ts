import {
  buildApprovedSettlement,
  resolveAllocation,
  resolveDistributableBase,
  totalCashReceived,
  type RailModel,
} from '@/lib/allocation';
import { moneyEquals } from '@/lib/money';
import { DataError } from '@/lib/result';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import { copy } from '@/copy/es-MX';
import { loadSyntheticDataset, type SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import type {
  OpportunityRailCard,
  OpportunitySummary,
  SettlementRepository,
} from '@/data/repositories/settlements';
import type { Opportunity } from '@/types/domain';

function summarise(dataset: SyntheticDataset, opportunity: Opportunity): OpportunitySummary {
  const project = dataset.projects.get(opportunity.projectId);
  const serviceVersion = dataset.serviceVersions.get(opportunity.serviceVersionId);
  if (project === undefined || serviceVersion === undefined) {
    throw new DataError(
      `Opportunity ${opportunity.id} references a missing project or service version`,
    );
  }
  return {
    id: opportunity.id,
    code: opportunity.code,
    beneficiaryName: opportunity.beneficiaryName,
    beneficiaryLocation: opportunity.beneficiaryLocation,
    status: opportunity.status,
    projectName: project.name,
    projectSlug: project.slug,
    serviceName: serviceVersion.name,
    serviceVersion: serviceVersion.version,
    openedAt: opportunity.openedAt,
  };
}

function buildCard(dataset: SyntheticDataset, opportunity: Opportunity): OpportunityRailCard {
  const ruleVersion = dataset.allocationRuleVersions.get(opportunity.allocationRuleVersionId);
  if (ruleVersion === undefined) {
    throw new DataError(
      `Opportunity ${opportunity.id} references a missing allocation rule version`,
    );
  }

  const events = dataset.cashEvents.filter((event) => event.opportunityId === opportunity.id);
  const distributableBase = resolveDistributableBase(
    ruleVersion.basePolicy,
    events,
    ruleVersion.currency,
  );
  const cashReceived = totalCashReceived(events, ruleVersion.currency);
  const settlement = dataset.settlements.find((entry) => entry.opportunityId === opportunity.id);

  let rail: RailModel;

  if (settlement !== undefined && settlement.status === 'approved') {
    if (!moneyEquals(settlement.base, distributableBase.base)) {
      throw new DataError(
        `Settlement ${settlement.id} base ${settlement.base.amount} does not match the policy-derived base ${distributableBase.base.amount}`,
      );
    }
    const approverId = settlement.approvedByMemberId;
    const approver = approverId === null ? undefined : dataset.members.get(approverId);
    if (approver === undefined) {
      throw new DataError(`Settlement ${settlement.id} references an unknown approver`);
    }
    rail = buildApprovedSettlement({
      settlement,
      lines: dataset.settlementLines.filter((line) => line.settlementId === settlement.id),
      ruleVersion,
      basePolicyLabel: distributableBase.policyLabel,
      approver,
    });
  } else {
    rail = resolveAllocation({
      ruleVersion,
      base: distributableBase.base,
      basePolicyLabel: distributableBase.policyLabel,
      assignments: dataset.assignments.filter(
        (assignment) => assignment.opportunityId === opportunity.id,
      ),
      members: dataset.members,
      organizations: dataset.organizations,
      unassignedLabel: copy.money.unassigned,
    });
  }

  return {
    opportunity: summarise(dataset, opportunity),
    rail,
    distributableBase,
    cashReceived,
  };
}

export const syntheticSettlementRepository: SettlementRepository = {
  async listOpportunityRails(viewer: ViewerContext): Promise<OpportunityRailCard[]> {
    assertFounder(viewer, 'listOpportunityRails');
    const dataset = loadSyntheticDataset();
    return dataset.opportunities.map((opportunity) => buildCard(dataset, opportunity));
  },

  async getOpportunityRail(
    opportunityId: string,
    viewer: ViewerContext,
  ): Promise<OpportunityRailCard | null> {
    assertFounder(viewer, 'getOpportunityRail');
    const dataset = loadSyntheticDataset();
    const opportunity = dataset.opportunities.find((entry) => entry.id === opportunityId);
    if (opportunity === undefined) return null;
    return buildCard(dataset, opportunity);
  },
};
