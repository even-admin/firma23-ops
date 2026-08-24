/**
 * Shared rail construction.
 *
 * The founder finance surfaces and a member's personal home both need the same
 * projected-or-approved rail for an opportunity. They differ only in how much of
 * it the viewer is allowed to see, so the construction lives here once.
 */

import {
  buildApprovedSettlement,
  resolveAllocation,
  resolveDistributableBase,
  totalCashReceived,
  type DistributableBase,
  type RailModel,
} from '@/lib/allocation';
import { moneyEquals, type Money } from '@/lib/money';
import { DataError } from '@/lib/result';
import { copy } from '@/copy/es-MX';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import type { OpportunitySummary } from '@/types/views';
import type { Opportunity, Settlement } from '@/types/domain';

export interface OpportunityRail {
  readonly opportunity: Opportunity;
  readonly summary: OpportunitySummary;
  readonly rail: RailModel;
  readonly distributableBase: DistributableBase;
  readonly cashReceived: Money;
}

export function summariseOpportunity(
  dataset: SyntheticDataset,
  opportunity: Opportunity,
): OpportunitySummary {
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

/**
 * The opportunity's currently active settlement: an approved original with
 * no approved reversal against it. Falls back to a pending draft, if any, so
 * a reversed-and-not-yet-reissued opportunity still shows a preview to work
 * from instead of nothing.
 */
function activeSettlementFor(
  dataset: SyntheticDataset,
  opportunityId: string,
): Settlement | undefined {
  const candidates = dataset.settlements.filter((entry) => entry.opportunityId === opportunityId);
  const approvedOriginals = candidates.filter(
    (entry) => entry.status === 'approved' && entry.kind === 'original',
  );
  const reversedOriginalIds = new Set(
    candidates
      .filter((entry) => entry.status === 'approved' && entry.kind === 'reversal')
      .map((entry) => entry.correctsSettlementId),
  );
  const active = approvedOriginals.find((entry) => !reversedOriginalIds.has(entry.id));
  if (active !== undefined) return active;
  return candidates.find((entry) => entry.status === 'pending');
}

export function buildOpportunityRail(
  dataset: SyntheticDataset,
  opportunity: Opportunity,
): OpportunityRail {
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
  const settlement = activeSettlementFor(dataset, opportunity.id);

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
    const lines = dataset.settlementLines.filter((line) => line.settlementId === settlement.id);
    const lineIds = new Set(lines.map((line) => line.id));
    rail = buildApprovedSettlement({
      settlement,
      lines,
      payouts: dataset.settlementLinePayouts.filter((payout) =>
        lineIds.has(payout.settlementLineId),
      ),
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
    opportunity,
    summary: summariseOpportunity(dataset, opportunity),
    rail,
    distributableBase,
    cashReceived,
  };
}
