import { copy } from '@/copy/es-MX';
import type { ApprovedSettlement } from '@/lib/allocation';
import { sumMoney, zeroMoney, type Money } from '@/lib/money';
import { DataError } from '@/lib/result';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type { FinanceRepository } from '@/data/repositories/finance';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOpportunityRail } from '@/data/repositories/synthetic/rails';
import {
  approvedBaseForOpportunity,
  cashEventViews,
  organizationApprovedForOpportunity,
  paidForOpportunity,
  poolWeightViews,
  settlementLineBalances,
} from '@/data/repositories/synthetic/shared';
import type {
  FinanceOverview,
  FinanceRow,
  RecordCashEventInput,
  RecordCashEventResult,
  RecordPayoutInput,
  RecordPayoutResult,
  SettlementPreview,
} from '@/types/views';

export function organizationRecipientApproved(rail: ApprovedSettlement): Money {
  return sumMoney(
    rail.segments
      .filter((segment) => segment.recipientBehavior === 'org_recipient')
      .map((segment) => segment.amount),
    rail.base.currency,
  );
}

export function buildFinanceOverview(
  dataset: SyntheticDataset,
  viewer: ViewerContext,
): FinanceOverview {
  assertFounder(viewer, 'getFinanceOverview');

  const rows: FinanceRow[] = [];
  const cashReceived = [];
  const approvedBases = [];
  const projectedBases = [];
  const paidAmounts = [];
  const houseAmounts = [];
  const owedAmounts = [];
  const recoveryAmounts = [];

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

    const approvedBase = approvedBaseForOpportunity(dataset, opportunity.id);
    const paid = paidForOpportunity(dataset, opportunity.id);
    const balances = settlementLineBalances(dataset).filter(
      (balance) => balance.opportunityId === opportunity.id,
    );
    if (approvedBase.amount !== 0) {
      approvedBases.push(approvedBase);
      paidAmounts.push(paid);
      houseAmounts.push(organizationApprovedForOpportunity(dataset, opportunity.id));
      owedAmounts.push(...balances.map((balance) => balance.owed));
      recoveryAmounts.push(...balances.map((balance) => balance.recovery));
    } else if (paid.amount !== 0) {
      paidAmounts.push(paid);
      owedAmounts.push(...balances.map((balance) => balance.owed));
      recoveryAmounts.push(...balances.map((balance) => balance.recovery));
    }
    if (built.rail.kind === 'projection') {
      // Projections are totalled separately and never folded into approved money.
      projectedBases.push(built.rail.base);
    }
  }

  return {
    totals: {
      cashReceived: sumMoney(cashReceived),
      distributableApproved: sumMoney(approvedBases),
      distributableProjected: sumMoney(projectedBases),
      paidOut: sumMoney(paidAmounts),
      owed: sumMoney(owedAmounts),
      recovery: sumMoney(recoveryAmounts),
      houseApproved: sumMoney(houseAmounts),
    },
    rows,
    pendingApprovals: dataset.settlements.filter((entry) => entry.status === 'pending').length,
  };
}

export const syntheticFinanceRepository: FinanceRepository = {
  async getOverview(viewer: ViewerContext): Promise<FinanceOverview> {
    return buildFinanceOverview(loadSyntheticDataset(), viewer);
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
      projectedDistributableBase:
        built.rail.kind === 'projection' ? built.rail.base : zeroMoney(built.distributableBase.base.currency),
      distributableBase: built.distributableBase.base,
      cashReceived: built.cashReceived,
      basePolicyLabel: built.distributableBase.policyLabel,
      basePolicyNote: built.distributableBase.policyNote,
      cashEvents: cashEventViews(dataset, opportunity.id, ruleVersion.basePolicy.includeTypes),
      pools,
      milestonesOutstanding,
      // M1 has no write path at all. Saying so is more honest than a dead button.
      approvalBlockedReason: copy.settle.blockedInM1,
    };
  },

  // The synthetic/local adapter never has a write path for canonical
  // finance facts, matching every other write boundary in this dataset —
  // it must not pretend a record was created when nothing was persisted.
  async recordCashEvent(
    _input: RecordCashEventInput,
    viewer: ViewerContext,
  ): Promise<RecordCashEventResult> {
    assertFounder(viewer, 'recordCashEvent');
    return { kind: 'unavailable', reason: copy.finance.writeBlockedReason };
  },

  async recordPayout(
    _input: RecordPayoutInput,
    viewer: ViewerContext,
  ): Promise<RecordPayoutResult> {
    assertFounder(viewer, 'recordPayout');
    return { kind: 'unavailable', reason: copy.finance.writeBlockedReason };
  },
};
