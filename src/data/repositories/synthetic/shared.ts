/**
 * Cross-repository derivations.
 *
 * Approved money is only ever read from settlement lines under an approved
 * settlement. Projected money is only ever read from a projection. Keeping both
 * derivations here means no repository re-implements either one slightly wrong.
 */

import { sumMoney, type Money } from '@/lib/money';
import { deriveMemberStats } from '@/lib/stats';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOpportunityRail } from '@/data/repositories/synthetic/rails';
import type { OpportunityStatus, SettlementLine } from '@/types/domain';
import type { CashEventView, MemberStats } from '@/types/views';

export const ACTIVE_STATUSES: readonly OpportunityStatus[] = [
  'draft',
  'assigned',
  'in_delivery',
  'delivered',
];

/** Settlement lines belonging to approved settlements only. */
export function approvedLinesFor(dataset: SyntheticDataset, memberId: string): SettlementLine[] {
  const approved = new Set(
    dataset.settlements.filter((entry) => entry.status === 'approved').map((entry) => entry.id),
  );
  return dataset.settlementLines.filter(
    (line) => line.memberId === memberId && approved.has(line.settlementId),
  );
}

export function approvedEarnings(dataset: SyntheticDataset, memberId: string): Money {
  return sumMoney(approvedLinesFor(dataset, memberId).map((line) => line.amount));
}

export function paidEarnings(dataset: SyntheticDataset, memberId: string): Money {
  return sumMoney(
    approvedLinesFor(dataset, memberId)
      .filter((line) => line.payoutStatus === 'paid')
      .map((line) => line.amount),
  );
}

/**
 * Projected earnings across every opportunity still awaiting approval.
 *
 * Never added to approved earnings anywhere. Callers receive it as its own value
 * precisely so that summing the two requires writing it out.
 */
export function projectedEarnings(dataset: SyntheticDataset, memberId: string): Money {
  const amounts: Money[] = [];

  for (const opportunity of dataset.opportunities) {
    const mine = dataset.assignments.filter(
      (assignment) =>
        assignment.opportunityId === opportunity.id && assignment.memberId === memberId,
    );
    if (mine.length === 0) continue;

    const built = buildOpportunityRail(dataset, opportunity);
    if (built.rail.kind !== 'projection') continue;

    for (const assignment of mine) {
      const participant = built.rail.segments
        .flatMap((segment) => segment.participants)
        .find((entry) => entry.key === assignment.id);
      if (participant !== undefined) amounts.push(participant.amount);
    }
  }

  return sumMoney(amounts);
}

export function activeWorkCount(dataset: SyntheticDataset, memberId: string): number {
  const active = new Set(
    dataset.opportunities
      .filter((opportunity) => ACTIVE_STATUSES.includes(opportunity.status))
      .map((opportunity) => opportunity.id),
  );
  return new Set(
    dataset.assignments
      .filter(
        (assignment) => assignment.memberId === memberId && active.has(assignment.opportunityId),
      )
      .map((assignment) => assignment.opportunityId),
  ).size;
}

export function statsFor(dataset: SyntheticDataset, memberId: string): MemberStats {
  return deriveMemberStats(dataset.statEvents.filter((event) => event.memberId === memberId));
}

export function cashEventViews(
  dataset: SyntheticDataset,
  opportunityId: string,
  includeTypes: readonly string[],
): CashEventView[] {
  return dataset.cashEvents
    .filter((event) => event.opportunityId === opportunityId)
    .map((event) => ({
      id: event.id,
      type: event.type,
      label: event.label,
      amount: event.amount,
      occurredAt: event.occurredAt,
      countsTowardBase: includeTypes.includes(event.type),
    }));
}
