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
 * Resolves approved, genuinely pending projection, and reversed-without-draft
 * states without inventing a new projection after a correction.
 */
type RailSource =
  | { readonly kind: 'settlement'; readonly settlement: Settlement }
  | { readonly kind: 'projection' }
  | { readonly kind: 'correction_required'; readonly reversal: Settlement };

function railSourceFor(dataset: SyntheticDataset, opportunityId: string): RailSource {
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
  if (active !== undefined) return { kind: 'settlement', settlement: active };
  if (candidates.some((entry) => entry.status === 'pending' && entry.kind === 'original')) {
    return { kind: 'projection' };
  }
  const reversal = candidates
    .filter((entry) => entry.status === 'approved' && entry.kind === 'reversal')
    .sort((a, b) => (b.approvedAt ?? '').localeCompare(a.approvedAt ?? ''))[0];
  if (reversal !== undefined) return { kind: 'correction_required', reversal };
  return { kind: 'projection' };
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
  const source = railSourceFor(dataset, opportunity.id);

  let rail: RailModel;

  if (source.kind === 'settlement') {
    const settlement = source.settlement;
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
  } else if (source.kind === 'projection') {
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
  } else {
    const reversedSettlementId = source.reversal.correctsSettlementId;
    if (reversedSettlementId === null || source.reversal.approvedAt === null) {
      throw new DataError(`Reversal ${source.reversal.id} lacks correction provenance`);
    }
    rail = {
      kind: 'correction_required',
      reversedSettlementId,
      reversalSettlementId: source.reversal.id,
      ruleVersionId: ruleVersion.id,
      ruleVersion: ruleVersion.version,
      reversedAt: source.reversal.approvedAt,
    };
  }

  return {
    opportunity,
    summary: summariseOpportunity(dataset, opportunity),
    rail,
    distributableBase,
    cashReceived,
  };
}
