import { copy } from '@/copy/es-MX';
import { subMoney, sumMoney } from '@/lib/money';
import { DataError } from '@/lib/result';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type { FinanceRepository } from '@/data/repositories/finance';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOpportunityRail } from '@/data/repositories/synthetic/rails';
import { cashEventViews, poolWeightViews } from '@/data/repositories/synthetic/shared';
import type { FinanceOverview, FinanceRow, SettlementPreview } from '@/types/views';

export const syntheticFinanceRepository: FinanceRepository = {
  async getOverview(viewer: ViewerContext): Promise<FinanceOverview> {
    assertFounder(viewer, 'getFinanceOverview');
    const dataset = loadSyntheticDataset();

    const rows: FinanceRow[] = [];
    const cashReceived = [];
    const approvedBases = [];
    const projectedBases = [];
    const paidAmounts = [];
    const houseAmounts = [];

    for (const opportunity of dataset.opportunities) {
      const built = buildOpportunityRail(dataset, opportunity);
      const ruleVersion = dataset.allocationRuleVersions.get(opportunity.allocationRuleVersionId);
      if (ruleVersion === undefined) {
        throw new DataError(`Opportunity ${opportunity.id} references a missing rule version`);
      }

      rows.push({
        opportunity: built.summary,
        rail: built.rail,
        distributableBase: built.distributableBase.base,
        cashReceived: built.cashReceived,
        cashEvents: cashEventViews(dataset, opportunity.id, ruleVersion.basePolicy.includeTypes),
      });

      cashReceived.push(built.cashReceived);

      if (built.rail.kind === 'settlement') {
        approvedBases.push(built.rail.base);
        paidAmounts.push(built.rail.paid);
        const house = built.rail.segments.find(
          (segment) => segment.recipientBehavior === 'org_recipient',
        );
        if (house !== undefined) houseAmounts.push(house.amount);
      } else {
        // Projections are totalled separately and never folded into approved money.
        projectedBases.push(built.rail.base);
      }
    }

    const distributableApproved = sumMoney(approvedBases);
    const paidOut = sumMoney(paidAmounts);

    return {
      totals: {
        cashReceived: sumMoney(cashReceived),
        distributableApproved,
        distributableProjected: sumMoney(projectedBases),
        paidOut,
        owed: subMoney(distributableApproved, paidOut),
        houseApproved: sumMoney(houseAmounts),
      },
      rows,
      pendingApprovals: dataset.settlements.filter((entry) => entry.status === 'pending').length,
    };
  },

  async getSettlementPreview(
    opportunityId: string,
    viewer: ViewerContext,
  ): Promise<SettlementPreview | null> {
    assertFounder(viewer, 'getSettlementPreview');
    const dataset = loadSyntheticDataset();
    const opportunity = dataset.opportunities.find((entry) => entry.id === opportunityId);
    if (opportunity === undefined) return null;

    const built = buildOpportunityRail(dataset, opportunity);
    const ruleVersion = dataset.allocationRuleVersions.get(opportunity.allocationRuleVersionId);
    if (ruleVersion === undefined) {
      throw new DataError(`Opportunity ${opportunity.id} references a missing rule version`);
    }

    const pools = poolWeightViews(
      ruleVersion,
      dataset.assignments.filter((assignment) => assignment.opportunityId === opportunity.id),
    );

    const milestonesOutstanding = dataset.opportunityMilestones.filter(
      (milestone) => milestone.opportunityId === opportunity.id && milestone.status !== 'done',
    ).length;

    return {
      opportunity: built.summary,
      rail: built.rail,
      distributableBase: built.distributableBase.base,
      basePolicyLabel: built.distributableBase.policyLabel,
      basePolicyNote: built.distributableBase.policyNote,
      cashEvents: cashEventViews(dataset, opportunity.id, ruleVersion.basePolicy.includeTypes),
      pools,
      milestonesOutstanding,
      // M1 has no write path at all. Saying so is more honest than a dead button.
      approvalBlockedReason: copy.settle.blockedInM1,
    };
  },
};
