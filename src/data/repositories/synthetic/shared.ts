/**
 * Cross-repository derivations.
 *
 * Approved money is only ever read from settlement lines under an approved
 * settlement. Projected money is only ever read from a projection. Keeping both
 * derivations here means no repository re-implements either one slightly wrong.
 */

import { BASIS_POINTS_TOTAL, sumMoney, type Money } from '@/lib/money';
import { deriveMemberStats } from '@/lib/stats';
import { DataError } from '@/lib/result';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOpportunityRail } from '@/data/repositories/synthetic/rails';
import type { OpportunityStatus, PayoutStatus, Settlement, SettlementLine } from '@/types/domain';
import type { CashEventView, MemberStats } from '@/types/views';

export const ACTIVE_STATUSES: readonly OpportunityStatus[] = [
  'draft',
  'assigned',
  'in_delivery',
  'delivered',
];

/**
 * Settlement lines belonging to any approved settlement — original or
 * reversal. Correct for signed aggregate totals (approvedEarnings below):
 * decision architecture-decision.md §4.2 requires approved earnings to be
 * the signed sum of approved original and reversal lines, which is exactly
 * what including both kinds and letting the reversal's negative amounts
 * net out produces. Not suitable for per-line, payout-status-bearing
 * display — use activeApprovedLinesFor for that.
 */
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

function settlementFor(dataset: SyntheticDataset, line: SettlementLine): Settlement {
  const settlement = dataset.settlements.find((entry) => entry.id === line.settlementId);
  if (settlement === undefined) {
    throw new DataError(`Settlement line ${line.id} references a missing settlement`);
  }
  return settlement;
}

/**
 * Signed sum of a line's settlement_line_payouts allocations, never stored.
 *
 * Only ever valid for a line of an original settlement — the database
 * forbids a payout from ever targeting a reversal's line, since a reversal
 * is a correction, not something that gets paid. Calling this on a
 * reversal line is a caller bug, not a display edge case, so it throws
 * rather than silently returning zero.
 */
export function payoutAllocatedFor(dataset: SyntheticDataset, line: SettlementLine): Money {
  if (settlementFor(dataset, line).kind !== 'original') {
    throw new DataError(
      `Settlement line ${line.id} belongs to a non-original settlement; it can never carry a payout`,
    );
  }
  return sumMoney(
    dataset.settlementLinePayouts
      .filter((payout) => payout.settlementLineId === line.id)
      .map((payout) => payout.amount),
  );
}

/** Rejects an out-of-range allocation total rather than clamping it to the nearest valid status. */
export function payoutStatusFor(dataset: SyntheticDataset, line: SettlementLine): PayoutStatus {
  const allocated = payoutAllocatedFor(dataset, line);
  if (allocated.amount < 0 || allocated.amount > line.amount.amount) {
    throw new DataError(
      `Settlement line ${line.id} payout allocations total ${allocated.amount} but must fall within 0..${line.amount.amount}`,
    );
  }
  if (allocated.amount === 0) return 'unpaid';
  if (allocated.amount === line.amount.amount) return 'paid';
  return 'partial';
}

/**
 * Ids of approved original settlements with no approved reversal against
 * them — the currently active, "this is what's true right now" settlements.
 */
function activeApprovedOriginalSettlementIds(dataset: SyntheticDataset): Set<string> {
  const reversedOriginalIds = new Set(
    dataset.settlements
      .filter((entry) => entry.status === 'approved' && entry.kind === 'reversal')
      .map((entry) => entry.correctsSettlementId)
      .filter((id): id is string => id !== null),
  );
  return new Set(
    dataset.settlements
      .filter(
        (entry) =>
          entry.status === 'approved' &&
          entry.kind === 'original' &&
          !reversedOriginalIds.has(entry.id),
      )
      .map((entry) => entry.id),
  );
}

/**
 * Settlement lines suitable for individual, payout-status-bearing display
 * (leaderboard provenance): only lines of the currently active, unreversed
 * approved original per opportunity. Excludes reversal lines entirely and
 * excludes lines whose original has since been reversed — neither
 * represents current truth worth showing as its own row, even though both
 * still contribute to the signed totals from approvedLinesFor above.
 */
export function activeApprovedLinesFor(dataset: SyntheticDataset, memberId: string): SettlementLine[] {
  const activeIds = activeApprovedOriginalSettlementIds(dataset);
  return dataset.settlementLines.filter(
    (line) => line.memberId === memberId && activeIds.has(line.settlementId),
  );
}

export function paidEarnings(dataset: SyntheticDataset, memberId: string): Money {
  // Reversal lines never carry a payout (payoutAllocatedFor would throw),
  // and a reversal doesn't undo money already disbursed against the
  // original it corrects — so "paid" sums every approved *original* line's
  // allocated total regardless of whether that original was later reversed.
  const originalLines = approvedLinesFor(dataset, memberId).filter(
    (line) => settlementFor(dataset, line).kind === 'original',
  );
  return sumMoney(originalLines.map((line) => payoutAllocatedFor(dataset, line)));
}

/**
 * Generalizes "this pool's assignment weights sum to 10,000bp" across every
 * member_pool share on the rule — not a hardcoded 'delivery' role key,
 * since different projects define different pool roles and a rule may have
 * more than one member_pool share.
 */
export function poolWeightSummary(
  ruleVersion: { readonly shares: readonly { readonly key: string; readonly recipientBehavior: string }[] },
  assignments: readonly { readonly roleKey: string; readonly weightBp: number }[],
): { readonly totalBp: number; readonly balanced: boolean } {
  const memberPoolShares = ruleVersion.shares.filter(
    (share) => share.recipientBehavior === 'member_pool',
  );
  let totalBp = 0;
  let balanced = true;
  for (const share of memberPoolShares) {
    const shareTotal = assignments
      .filter((assignment) => assignment.roleKey === share.key)
      .reduce<number>((acc, assignment) => acc + assignment.weightBp, 0);
    totalBp += shareTotal;
    if (shareTotal !== BASIS_POINTS_TOTAL) balanced = false;
  }
  return { totalBp, balanced };
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
