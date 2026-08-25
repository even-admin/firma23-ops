/**
 * Allocation engine.
 *
 * The rule is always an argument. There is no house percentage, closer percentage,
 * or delivery percentage anywhere in this file. SETY's 30/20/50 exists only inside
 * src/data/fixtures/projects/sety-2026/allocation-rule-versions.json.
 *
 * The projected/approved firewall lives in the RailModel union below. A projection
 * carries no settlement id and no approval timestamp, so no consumer can render
 * projected money with approved chrome. "Paid" is not a third top-level state; it
 * is a per-line payout status reachable only from an approved settlement.
 */

import {
  BASIS_POINTS_TOTAL,
  basisPoints,
  type BasisPoints,
  type CurrencyCode,
  type Money,
  moneyEquals,
  splitByWeights,
  subMoney,
  sumMoney,
} from '@/lib/money';
import type {
  AllocationRecipientBehavior,
  AllocationRuleVersion,
  Assignment,
  BasePolicy,
  CashEvent,
  CashEventType,
  Member,
  Organization,
  PayoutStatus,
  Settlement,
  SettlementLine,
  SettlementLinePayout,
} from '@/types/domain';

export class AllocationError extends Error {
  override readonly name = 'AllocationError';
}

/** Cash that actually arrived, regardless of whether it is distributable. */
const CASH_RECEIPT_TYPES: readonly CashEventType[] = ['deposit', 'contribution'];

export interface SegmentParticipant {
  readonly key: string;
  readonly memberId: string | null;
  readonly displayName: string;
  readonly initials: string;
  readonly roleLabel: string;
  readonly weightBp: BasisPoints;
  readonly amount: Money;
}

export interface SettledLine extends SegmentParticipant {
  readonly lineId: string;
  /** Derived from this line's settlement_line_payouts, never stored. */
  readonly payoutStatus: PayoutStatus;
}

export interface RailSegment<P extends SegmentParticipant = SegmentParticipant> {
  readonly key: string;
  readonly recipientBehavior: AllocationRecipientBehavior;
  readonly label: string;
  readonly weightBp: BasisPoints;
  readonly amount: Money;
  readonly participants: readonly P[];
}

export type SettledSegment = RailSegment<SettledLine>;

export interface DistributableBase {
  readonly base: Money;
  readonly policyLabel: string;
  readonly policyNote: string;
  readonly included: readonly CashEvent[];
  readonly excluded: readonly CashEvent[];
}

export interface AllocationProjection {
  readonly kind: 'projection';
  readonly ruleVersionId: string;
  readonly ruleVersion: number;
  readonly base: Money;
  readonly basePolicyLabel: string;
  readonly segments: readonly RailSegment[];
  readonly fullyAssigned: boolean;
}

export interface ApprovedSettlement {
  readonly kind: 'settlement';
  readonly settlementId: string;
  readonly ruleVersionId: string;
  readonly ruleVersion: number;
  readonly approvedAt: string;
  readonly approvedByMemberId: string;
  readonly approvedByDisplayName: string;
  readonly base: Money;
  readonly basePolicyLabel: string;
  readonly segments: readonly SettledSegment[];
  readonly paid: Money;
  readonly unpaid: Money;
}

/**
 * An approved original was reversed and no pending replacement exists yet.
 * This state intentionally carries no money or segments: a correction gap is
 * neither a new projection nor an approved allocation.
 */
export interface CorrectionRequired {
  readonly kind: 'correction_required';
  readonly reversedSettlementId: string;
  readonly reversalSettlementId: string;
  readonly ruleVersionId: string;
  readonly ruleVersion: number;
  readonly reversedAt: string;
}

/**
 * The complete rail-state contract consumed by allocation surfaces.
 *
 * Discriminating on `kind` is what makes "projected shown as approved" a type
 * error rather than a code review question. `correction_required` deliberately
 * carries no money at all.
 */
export type RailModel = AllocationProjection | ApprovedSettlement | CorrectionRequired;

export function resolveDistributableBase(
  policy: BasePolicy,
  events: readonly CashEvent[],
  currency: CurrencyCode,
): DistributableBase {
  const included = events.filter((event) => policy.includeTypes.includes(event.type));
  const excluded = events.filter((event) => !policy.includeTypes.includes(event.type));
  const base = sumMoney(
    included.map((event) => event.amount),
    currency,
  );

  if (base.amount < 0) {
    throw new AllocationError(`Distributable base cannot be negative: ${base.amount}`);
  }

  return {
    base,
    policyLabel: policy.label,
    policyNote: policy.note,
    included,
    excluded,
  };
}

/** Cash received, which is a different number from the distributable base. */
export function totalCashReceived(events: readonly CashEvent[], currency: CurrencyCode): Money {
  return sumMoney(
    events.filter((event) => CASH_RECEIPT_TYPES.includes(event.type)).map((event) => event.amount),
    currency,
  );
}

function assertSharesComplete(ruleVersion: AllocationRuleVersion): void {
  const total = ruleVersion.shares.reduce<number>((acc, share) => acc + share.weightBp, 0);
  if (total !== BASIS_POINTS_TOTAL) {
    throw new AllocationError(
      `Allocation rule ${ruleVersion.id} shares total ${total} basis points, expected ${BASIS_POINTS_TOTAL}`,
    );
  }
}

export interface ResolveAllocationInput {
  readonly ruleVersion: AllocationRuleVersion;
  readonly base: Money;
  readonly basePolicyLabel: string;
  readonly assignments: readonly Assignment[];
  readonly members: ReadonlyMap<string, Member>;
  readonly organizations: ReadonlyMap<string, Organization>;
  readonly unassignedLabel: string;
}

/**
 * Project what a settlement would look like. This is never earned money.
 */
export function resolveAllocation(input: ResolveAllocationInput): AllocationProjection {
  const { ruleVersion, base, assignments, members, organizations } = input;
  assertSharesComplete(ruleVersion);

  const shareAmounts = splitByWeights(
    base,
    ruleVersion.shares.map((share) => share.weightBp),
  );

  let fullyAssigned = true;

  const segments: RailSegment[] = ruleVersion.shares.map((share, index) => {
    const amount = shareAmounts[index];
    if (amount === undefined) {
      throw new AllocationError(`Missing computed amount for share ${share.key}`);
    }

    if (share.recipientBehavior === 'org_recipient') {
      const org =
        share.recipientOrgId === null ? undefined : organizations.get(share.recipientOrgId);
      if (org === undefined) {
        throw new AllocationError(
          `org_recipient share ${share.key} has no resolvable recipient organization`,
        );
      }
      return {
        key: share.key,
        recipientBehavior: share.recipientBehavior,
        label: share.label,
        weightBp: share.weightBp,
        amount,
        participants: [
          {
            key: `${share.key}:${org.id}`,
            memberId: null,
            displayName: org.name,
            initials: initialsFor(org.name),
            roleLabel: share.label,
            weightBp: basisPoints(BASIS_POINTS_TOTAL),
            amount,
          },
        ],
      };
    }

    // member_pool: split across assignments whose roleKey equals this
    // share's own key, since a project defines its own pool roles rather
    // than choosing between a fixed pair.
    const roleAssignments = assignments.filter((assignment) => assignment.roleKey === share.key);

    if (roleAssignments.length === 0) {
      fullyAssigned = false;
      return {
        key: share.key,
        recipientBehavior: share.recipientBehavior,
        label: share.label,
        weightBp: share.weightBp,
        amount,
        participants: [],
      };
    }

    const participantAmounts = splitByWeights(
      amount,
      roleAssignments.map((assignment) => assignment.weightBp),
    );

    const participants: SegmentParticipant[] = roleAssignments.map((assignment, position) => {
      const member = members.get(assignment.memberId);
      if (member === undefined) {
        throw new AllocationError(`Assignment ${assignment.id} references unknown member`);
      }
      const participantAmount = participantAmounts[position];
      if (participantAmount === undefined) {
        throw new AllocationError(`Missing computed amount for assignment ${assignment.id}`);
      }
      return {
        key: assignment.id,
        memberId: member.id,
        displayName: member.displayName,
        initials: member.initials,
        roleLabel: assignment.roleLabel,
        weightBp: assignment.weightBp,
        amount: participantAmount,
      };
    });

    return {
      key: share.key,
      recipientBehavior: share.recipientBehavior,
      label: share.label,
      weightBp: share.weightBp,
      amount,
      participants,
    };
  });

  assertSegmentsSumToBase(segments, base, `projection for rule ${ruleVersion.id}`);

  return {
    kind: 'projection',
    ruleVersionId: ruleVersion.id,
    ruleVersion: ruleVersion.version,
    base,
    basePolicyLabel: input.basePolicyLabel,
    segments,
    fullyAssigned,
  };
}

export interface BuildApprovedSettlementInput {
  readonly settlement: Settlement;
  readonly lines: readonly SettlementLine[];
  /** Every settlement_line_payouts row for the lines above, in any order. */
  readonly payouts: readonly SettlementLinePayout[];
  readonly ruleVersion: AllocationRuleVersion;
  readonly basePolicyLabel: string;
  readonly approver: Member;
}

/**
 * Sum of a line's payout allocations, and the status that sum implies.
 *
 * Only ever called on a line of an original settlement — the database
 * forbids a payout from ever targeting a reversal's line, and
 * buildApprovedSettlement below rejects a reversal before this can run. An
 * allocation total outside 0..line.amount is a data-integrity failure, not
 * a display edge case, so it is rejected rather than clamped to the
 * nearest valid status.
 */
function derivePayoutStatus(
  line: SettlementLine,
  payouts: readonly SettlementLinePayout[],
): { readonly allocated: Money; readonly status: PayoutStatus } {
  const allocated = sumMoney(
    payouts.filter((payout) => payout.settlementLineId === line.id).map((payout) => payout.amount),
    line.amount.currency,
  );
  if (allocated.amount < 0 || allocated.amount > line.amount.amount) {
    throw new AllocationError(
      `Settlement line ${line.id} payout allocations total ${allocated.amount} but must fall within 0..${line.amount.amount}`,
    );
  }
  if (allocated.amount === 0) return { allocated, status: 'unpaid' };
  if (allocated.amount === line.amount.amount) return { allocated, status: 'paid' };
  return { allocated, status: 'partial' };
}

/**
 * Build an approved settlement view.
 *
 * A pending settlement cannot produce this type. That is the whole point: there is
 * no code path from an unapproved record to a value the UI treats as earned.
 */
export function buildApprovedSettlement(input: BuildApprovedSettlementInput): ApprovedSettlement {
  const { settlement, ruleVersion, approver } = input;

  if (settlement.status !== 'approved') {
    throw new AllocationError(
      `Settlement ${settlement.id} is ${settlement.status}; only approved settlements produce settled money`,
    );
  }
  if (settlement.kind !== 'original') {
    throw new AllocationError(
      `Settlement ${settlement.id} is a ${settlement.kind}; only an original settlement renders a rail`,
    );
  }
  const { approvedAt, approvedByMemberId } = settlement;
  if (approvedAt === null || approvedByMemberId === null) {
    throw new AllocationError(
      `Settlement ${settlement.id} is approved but missing approval provenance`,
    );
  }
  if (approvedByMemberId !== approver.id) {
    throw new AllocationError(`Settlement ${settlement.id} approver mismatch`);
  }
  if (approver.role !== 'founder') {
    throw new AllocationError(`Settlement ${settlement.id} was approved by a non-founder`);
  }

  assertSharesComplete(ruleVersion);

  const foreign = input.lines.filter((line) => line.settlementId !== settlement.id);
  if (foreign.length > 0) {
    throw new AllocationError(`Settlement ${settlement.id} received lines from another settlement`);
  }
  if (input.lines.length === 0) {
    throw new AllocationError(`Approved settlement ${settlement.id} has no lines`);
  }

  const ordered = [...input.lines].sort((a, b) => a.sequence - b.sequence);

  const segments: SettledSegment[] = ruleVersion.shares.map((share) => {
    const shareLines = ordered.filter((line) => line.shareKey === share.key);
    const participants: SettledLine[] = shareLines.map((line) => ({
      key: line.id,
      lineId: line.id,
      memberId: line.memberId,
      displayName: line.recipientLabel,
      initials: initialsFor(line.recipientLabel),
      roleLabel: line.roleLabel,
      weightBp: line.weightBp,
      amount: line.amount,
      payoutStatus: derivePayoutStatus(line, input.payouts).status,
    }));

    return {
      key: share.key,
      recipientBehavior: share.recipientBehavior,
      label: share.label,
      weightBp: share.weightBp,
      amount: sumMoney(
        participants.map((participant) => participant.amount),
        settlement.base.currency,
      ),
      participants,
    };
  });

  const unknownShareKeys = ordered.filter(
    (line) => !ruleVersion.shares.some((share) => share.key === line.shareKey),
  );
  if (unknownShareKeys.length > 0) {
    throw new AllocationError(
      `Settlement ${settlement.id} has lines for shares absent from rule ${ruleVersion.id}`,
    );
  }

  assertSegmentsSumToBase(segments, settlement.base, `settlement ${settlement.id}`);

  const paid = sumMoney(
    ordered.map((line) => derivePayoutStatus(line, input.payouts).allocated),
    settlement.base.currency,
  );

  return {
    kind: 'settlement',
    settlementId: settlement.id,
    ruleVersionId: ruleVersion.id,
    ruleVersion: ruleVersion.version,
    approvedAt,
    approvedByMemberId,
    approvedByDisplayName: approver.displayName,
    base: settlement.base,
    basePolicyLabel: input.basePolicyLabel,
    segments,
    paid,
    unpaid: subMoney(settlement.base, paid),
  };
}

/** Invariant 5: settlement lines sum exactly to the approved distributable base. */
function assertSegmentsSumToBase(
  segments: readonly RailSegment<SegmentParticipant>[],
  base: Money,
  context: string,
): void {
  const total = sumMoney(
    segments.map((segment) => segment.amount),
    base.currency,
  );
  if (!moneyEquals(total, base)) {
    throw new AllocationError(
      `Allocation for ${context} sums to ${total.amount} but the base is ${base.amount}`,
    );
  }
  for (const segment of segments) {
    if (segment.participants.length === 0) continue;
    const participantTotal = sumMoney(
      segment.participants.map((participant) => participant.amount),
      base.currency,
    );
    if (!moneyEquals(participantTotal, segment.amount)) {
      throw new AllocationError(
        `Segment ${segment.key} participants sum to ${participantTotal.amount} but the segment is ${segment.amount}`,
      );
    }
  }
}

export function initialsFor(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const first = words[0]?.[0] ?? '?';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${second}`.toUpperCase();
}
