import { describe, expect, it } from 'vitest';

import {
  buildFinanceOverview,
  organizationRecipientApproved,
} from '@/data/repositories/synthetic/finance';
import { buildPersonalHome } from '@/data/repositories/synthetic/home';
import {
  buildLeaderboardProvenance,
  buildLeaderboardRows,
} from '@/data/repositories/synthetic/leaderboard';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import { basisPoints, money, negateMoney } from '@/lib/money';
import type { ApprovedSettlement } from '@/lib/allocation';
import type { CashEvent, Settlement, SettlementLine, SettlementLinePayout } from '@/types/domain';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';

const SETTLED_OPPORTUNITY_ID = 'f0000000-0000-4000-8000-000000000002';
const ORIGINAL_SETTLEMENT_ID = '20000000-0000-4000-8000-000000000002';
const MEMBER_LINE_ID = '40000000-0000-4000-8000-000000000003';
const REISSUED_SETTLEMENT_ID = '20000000-0000-4000-8000-000000000100';
const REISSUED_MEMBER_LINE_ID = '49100000-0000-4000-8000-000000000003';

function assertPayoutFixturesValid(dataset: SyntheticDataset): void {
  const payoutEvents = dataset.cashEvents.filter((event) => event.type === 'payout');
  const eventsById = new Map(payoutEvents.map((event) => [event.id, event]));
  const linesById = new Map(dataset.settlementLines.map((line) => [line.id, line]));
  const settlementsById = new Map(
    dataset.settlements.map((settlement) => [settlement.id, settlement]),
  );

  for (const event of payoutEvents) {
    const allocations = dataset.settlementLinePayouts.filter(
      (allocation) => allocation.payoutCashEventId === event.id,
    );
    const allocated = allocations.reduce(
      (total, allocation) => total + allocation.amount.amount,
      0,
    );
    if (allocations.length === 0 || allocated !== -event.amount.amount) {
      throw new Error(`payout event ${event.id} does not reconcile`);
    }
  }
  for (const allocation of dataset.settlementLinePayouts) {
    const event = eventsById.get(allocation.payoutCashEventId);
    const line = linesById.get(allocation.settlementLineId);
    const settlement = line === undefined ? undefined : settlementsById.get(line.settlementId);
    if (
      event === undefined ||
      line === undefined ||
      settlement === undefined ||
      event.opportunityId !== settlement.opportunityId ||
      event.amount.currency !== allocation.amount.currency ||
      line.amount.currency !== allocation.amount.currency
    ) {
      throw new Error(`payout allocation ${allocation.id} violates event/line authority`);
    }
  }
}

function withPaidMemberAndReversal({
  reissue,
  transfer = false,
  reissueMemberId = PROTOTYPE_MEMBER.viewerId,
}: {
  readonly reissue: boolean;
  readonly transfer?: boolean;
  readonly reissueMemberId?: string;
}): SyntheticDataset {
  const original = loadSyntheticDataset();
  const originalSettlement = original.settlements.find(
    (settlement) => settlement.id === ORIGINAL_SETTLEMENT_ID,
  );
  if (originalSettlement === undefined) throw new Error('missing original settlement fixture');
  const originalLines = original.settlementLines.filter(
    (line) => line.settlementId === ORIGINAL_SETTLEMENT_ID,
  );

  const payoutEvent: CashEvent = {
    id: '30000000-0000-4000-8000-000000000099',
    opportunityId: SETTLED_OPPORTUNITY_ID,
    type: 'payout',
    label: 'Pago de prueba al miembro',
    amount: money(-179_454),
    occurredAt: '2026-08-20',
  };
  const memberPayout: SettlementLinePayout = {
    id: '50000000-0000-4000-8000-000000000099',
    settlementLineId: MEMBER_LINE_ID,
    payoutCashEventId: payoutEvent.id,
    amount: money(179_454),
    createdAt: '2026-08-20T00:00:00.000Z',
    createdByMemberId: PROTOTYPE_FOUNDER.viewerId,
    idempotencyKey: 'reversal-member-payout',
  };
  const reversal: Settlement = {
    ...originalSettlement,
    id: '20000000-0000-4000-8000-000000000099',
    kind: 'reversal',
    correctsSettlementId: originalSettlement.id,
    base: negateMoney(originalSettlement.base),
    approvedAt: '2026-08-21T00:00:00.000Z',
  };
  const reversalLines: SettlementLine[] = originalLines.map((line, index) => ({
    ...line,
    id: `49000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    settlementId: reversal.id,
    amount: negateMoney(line.amount),
    sequence: index + 1,
  }));

  const reissuedSettlement: Settlement | null = reissue
    ? {
        ...originalSettlement,
        id: REISSUED_SETTLEMENT_ID,
        approvedAt: '2026-08-22T00:00:00.000Z',
      }
    : null;
  const reissuedLines: SettlementLine[] =
    reissuedSettlement === null
      ? []
      : originalLines.map((line, index) => ({
          ...line,
          id: `49100000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          settlementId: reissuedSettlement.id,
          ...(line.id === MEMBER_LINE_ID
            ? {
                memberId: reissueMemberId,
                recipientLabel:
                  original.members.get(reissueMemberId)?.displayName ?? line.recipientLabel,
              }
            : {}),
          sequence: index + 1,
        }));
  const originalLineIds = new Set(originalLines.map((line) => line.id));
  const paidAllocations = [
    ...original.settlementLinePayouts.filter((payout) =>
      originalLineIds.has(payout.settlementLineId),
    ),
    memberPayout,
  ];
  const transferAllocations: SettlementLinePayout[] =
    transfer && reissuedSettlement !== null
      ? paidAllocations.flatMap((payout, index) => {
          const originalIndex = originalLines.findIndex(
            (line) => line.id === payout.settlementLineId,
          );
          const replacement = reissuedLines[originalIndex];
          if (replacement === undefined) throw new Error('missing replacement line');
          return [
            {
              ...payout,
              id: `51000000-0000-4000-8000-${String(index * 2 + 1).padStart(12, '0')}`,
              amount: negateMoney(payout.amount),
              createdAt: '2026-08-23T00:00:00.000Z',
              idempotencyKey: `reversal-transfer-old-${index}`,
            },
            {
              ...payout,
              id: `51000000-0000-4000-8000-${String(index * 2 + 2).padStart(12, '0')}`,
              settlementLineId: replacement.id,
              createdAt: '2026-08-23T00:00:00.000Z',
              idempotencyKey: `reversal-transfer-new-${index}`,
            },
          ];
        })
      : [];

  const dataset: SyntheticDataset = {
    ...original,
    assignments: original.assignments.map((assignment) =>
      reissueMemberId !== PROTOTYPE_MEMBER.viewerId &&
      assignment.opportunityId === SETTLED_OPPORTUNITY_ID &&
      assignment.memberId === PROTOTYPE_MEMBER.viewerId &&
      assignment.roleLabel === 'Producción audiovisual'
        ? { ...assignment, memberId: reissueMemberId }
        : assignment,
    ),
    cashEvents: [...original.cashEvents, payoutEvent],
    settlements: [
      ...original.settlements,
      reversal,
      ...(reissuedSettlement === null ? [] : [reissuedSettlement]),
    ],
    settlementLines: [...original.settlementLines, ...reversalLines, ...reissuedLines],
    settlementLinePayouts: [
      ...original.settlementLinePayouts,
      memberPayout,
      ...transferAllocations,
    ],
  };
  assertPayoutFixturesValid(dataset);
  return dataset;
}

describe('financial aggregate shapes', () => {
  it('sums every organization-recipient segment', () => {
    const rail: ApprovedSettlement = {
      kind: 'settlement',
      settlementId: 'settlement-1',
      ruleVersionId: 'rule-1',
      ruleVersion: 1,
      approvedAt: '2026-08-25T00:00:00.000Z',
      approvedByMemberId: 'founder-1',
      approvedByDisplayName: 'Founder',
      base: money(1_000),
      basePolicyLabel: 'Test policy',
      segments: [
        {
          key: 'org-a',
          recipientBehavior: 'org_recipient',
          label: 'Organization A',
          weightBp: basisPoints(1_000),
          amount: money(100),
          participants: [],
        },
        {
          key: 'org-b',
          recipientBehavior: 'org_recipient',
          label: 'Organization B',
          weightBp: basisPoints(2_000),
          amount: money(200),
          participants: [],
        },
        {
          key: 'crew',
          recipientBehavior: 'member_pool',
          label: 'Crew',
          weightBp: basisPoints(7_000),
          amount: money(700),
          participants: [],
        },
      ],
      paid: money(0),
      unpaid: money(1_000),
    };

    expect(organizationRecipientApproved(rail).amount).toBe(300);
  });

  it('correlates one member in two shares and includes a partial payout exactly once', () => {
    const original = loadSyntheticDataset();
    const opportunityId = 'f0000000-0000-4000-8000-000000000002';
    const closerAssignmentId = '10000000-0000-4000-8000-000000000005';
    const closerLineId = '40000000-0000-4000-8000-000000000002';
    const deliveryLineId = '40000000-0000-4000-8000-000000000003';

    const dataset = {
      ...original,
      assignments: original.assignments.map((assignment) =>
        assignment.id === closerAssignmentId
          ? { ...assignment, memberId: PROTOTYPE_MEMBER.viewerId }
          : assignment,
      ),
      settlementLines: original.settlementLines.map((line) =>
        line.id === closerLineId
          ? {
              ...line,
              memberId: PROTOTYPE_MEMBER.viewerId,
              recipientLabel: 'Sebastián Benítez',
            }
          : line,
      ),
      settlementLinePayouts: [
        ...original.settlementLinePayouts,
        {
          id: '50000000-0000-4000-8000-000000000099',
          settlementLineId: deliveryLineId,
          payoutCashEventId: '30000000-0000-4000-8000-000000000099',
          amount: money(50_000),
          createdAt: '2026-08-25T00:00:00.000Z',
          createdByMemberId: PROTOTYPE_MEMBER.viewerId,
          idempotencyKey: 'partial-payout-shape-test',
        },
      ],
      cashEvents: [
        ...original.cashEvents,
        {
          id: '30000000-0000-4000-8000-000000000099',
          opportunityId,
          type: 'payout' as const,
          label: 'Pago parcial de prueba',
          amount: money(-50_000),
          occurredAt: '2026-08-25',
        },
      ],
    };
    assertPayoutFixturesValid(dataset);

    const home = buildPersonalHome(dataset, PROTOTYPE_MEMBER);
    const settled = home.assignments.filter((entry) => entry.opportunityId === opportunityId);

    expect(settled).toHaveLength(2);
    expect(settled.map((entry) => entry.roleLabel).sort()).toEqual([
      'Cierre',
      'Producción audiovisual',
    ]);
    expect(settled.every((entry) => entry.money.kind === 'approved')).toBe(true);
    expect(
      settled
        .map((entry) => (entry.money.kind === 'approved' ? entry.money.amount.amount : 0))
        .sort((a, b) => a - b),
    ).toEqual([179_454, 179_454]);
    expect(home.money.approved.amount).toBe(358_908);
    expect(home.money.paid.amount).toBe(229_454);
    expect(home.money.approvedUnpaid.amount).toBe(129_454);
    expect(home.money.recovery.amount).toBe(0);
  });

  it('preserves paid cash and exposes recovery after an approved settlement reversal', () => {
    const baseline = loadSyntheticDataset();
    const baselineHome = buildPersonalHome(baseline, PROTOTYPE_MEMBER);
    const baselineFinance = buildFinanceOverview(baseline, PROTOTYPE_FOUNDER);
    const baselineRow = buildLeaderboardRows(baseline, PROTOTYPE_FOUNDER).find(
      (row) => row.memberId === PROTOTYPE_MEMBER.viewerId,
    );
    const dataset = withPaidMemberAndReversal({ reissue: false });
    const home = buildPersonalHome(dataset, PROTOTYPE_MEMBER);
    const finance = buildFinanceOverview(dataset, PROTOTYPE_FOUNDER);
    const row = buildLeaderboardRows(dataset, PROTOTYPE_FOUNDER).find(
      (entry) => entry.memberId === PROTOTYPE_MEMBER.viewerId,
    );
    const reversedRow = finance.rows.find((row) => row.opportunity.id === SETTLED_OPPORTUNITY_ID);

    expect(home.money.approved.amount).toBe(0);
    expect(home.money.paid.amount).toBe(179_454);
    expect(home.money.approvedUnpaid.amount).toBe(0);
    expect(home.money.recovery.amount).toBe(179_454);
    expect(home.performance.series.find((series) => series.key === 'approved')?.points.at(-1)).toMatchObject({
      value: money(0),
      state: 'correction',
    });
    expect(
      home.performance.series.find((series) => series.key === 'approved_unpaid')?.points.at(-1),
    ).toMatchObject({
      value: money(0),
      state: 'recovery',
    });
    expect(home.performance.series.find((series) => series.key === 'paid')?.points.at(-1)).toMatchObject({
      value: money(179_454),
    });
    expect(reversedRow?.rail.kind).toBe('correction_required');
    expect(
      home.assignments.find((assignment) => assignment.opportunityId === SETTLED_OPPORTUNITY_ID)
        ?.money.kind,
    ).toBe('correction_required');
    expect(home.money.projected).toEqual(baselineHome.money.projected);
    expect(finance.totals.distributableProjected).toEqual(
      baselineFinance.totals.distributableProjected,
    );
    expect(row?.projectedEarnings).toEqual(baselineRow?.projectedEarnings);
    expect(finance.totals.paidOut.amount).toBeGreaterThanOrEqual(628_089);
    expect(finance.totals.recovery.amount).toBe(628_089);
    expect(finance.totals.owed.amount).toBeGreaterThanOrEqual(0);
  });

  it('keeps recovery and a replacement obligation visible simultaneously before transfer', () => {
    const dataset = withPaidMemberAndReversal({ reissue: true });
    const home = buildPersonalHome(dataset, PROTOTYPE_MEMBER);
    const finance = buildFinanceOverview(dataset, PROTOTYPE_FOUNDER);
    const reissuedRow = finance.rows.find((row) => row.opportunity.id === SETTLED_OPPORTUNITY_ID);
    const provenance = buildLeaderboardProvenance(dataset, 'sebastian-benitez', PROTOTYPE_MEMBER);

    expect(home.money.approved.amount).toBe(179_454);
    expect(home.money.paid.amount).toBe(179_454);
    expect(home.money.approvedUnpaid.amount).toBe(179_454);
    expect(home.money.recovery.amount).toBe(179_454);
    expect(reissuedRow?.rail.kind).toBe('settlement');
    expect(finance.totals.paidOut.amount).toBe(3_128_089);
    expect(finance.totals.recovery.amount).toBe(628_089);
    expect(finance.totals.owed.amount).toBe(897_270);
    expect(
      provenance?.entries.find((entry) => entry.settlementId === REISSUED_SETTLEMENT_ID),
    ).toMatchObject({ payoutStatus: 'unpaid' });
  });

  it('moves allocation with an explicit old-to-new transfer without changing paid cash', () => {
    const before = withPaidMemberAndReversal({ reissue: true });
    const after = withPaidMemberAndReversal({ reissue: true, transfer: true });
    const beforeFinance = buildFinanceOverview(before, PROTOTYPE_FOUNDER);
    const afterFinance = buildFinanceOverview(after, PROTOTYPE_FOUNDER);
    const home = buildPersonalHome(after, PROTOTYPE_MEMBER);
    const rows = buildLeaderboardRows(after, PROTOTYPE_FOUNDER);
    const provenance = buildLeaderboardProvenance(after, 'sebastian-benitez', PROTOTYPE_MEMBER);

    expect(afterFinance.totals.paidOut).toEqual(beforeFinance.totals.paidOut);
    expect(afterFinance.totals.recovery.amount).toBe(0);
    expect(afterFinance.totals.owed.amount).toBe(269_181);
    expect(home.money.approvedUnpaid.amount).toBe(0);
    expect(home.money.recovery.amount).toBe(0);
    expect(
      home.performance.series.find((series) => series.key === 'approved_unpaid')?.points.at(-1),
    ).toMatchObject({ value: money(0) });
    expect(
      rows.find((row) => row.memberId === PROTOTYPE_MEMBER.viewerId)?.paidEarnings?.amount,
    ).toBe(179_454);
    expect(
      provenance?.entries.find((entry) => entry.settlementId === REISSUED_SETTLEMENT_ID),
    ).toMatchObject({ payoutStatus: 'paid' });
  });

  it('does not offset a changed recipient or a different opportunity', () => {
    const replacementMemberId = 'b0000000-0000-4000-8000-000000000006';
    const dataset = withPaidMemberAndReversal({
      reissue: true,
      reissueMemberId: replacementMemberId,
    });
    const originalMemberHome = buildPersonalHome(dataset, PROTOTYPE_MEMBER);
    const rows = buildLeaderboardRows(dataset, PROTOTYPE_FOUNDER);
    const originalRow = rows.find((row) => row.memberId === PROTOTYPE_MEMBER.viewerId);
    const replacementRow = rows.find((row) => row.memberId === replacementMemberId);

    expect(originalMemberHome.money.approved.amount).toBe(0);
    expect(originalMemberHome.money.recovery.amount).toBe(179_454);
    expect(originalRow?.paidEarnings?.amount).toBe(179_454);
    expect(replacementRow?.approvedEarnings.amount).toBeGreaterThan(
      replacementRow?.paidEarnings?.amount ?? 0,
    );
    expect(
      dataset.settlementLines.find((line) => line.id === REISSUED_MEMBER_LINE_ID)?.memberId,
    ).toBe(replacementMemberId);

    const crossOpportunity = withPaidMemberAndReversal({ reissue: false });
    const withUnpaidOtherOpportunity = {
      ...crossOpportunity,
      cashEvents: crossOpportunity.cashEvents.filter(
        (event) => event.id !== '30000000-0000-4000-8000-000000000034',
      ),
      settlementLinePayouts: crossOpportunity.settlementLinePayouts.filter(
        (payout) => payout.id !== '50000000-0000-4000-8000-000000000011',
      ),
    };
    assertPayoutFixturesValid(withUnpaidOtherOpportunity);
    const finance = buildFinanceOverview(withUnpaidOtherOpportunity, PROTOTYPE_FOUNDER);
    expect(finance.totals.recovery.amount).toBe(628_089);
    expect(finance.totals.owed.amount).toBe(625_000);
  });
});
