import { describe, expect, it } from 'vitest';

import {
  buildFinanceOverview,
  organizationRecipientApproved,
} from '@/data/repositories/synthetic/finance';
import { buildPersonalHome } from '@/data/repositories/synthetic/home';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import { basisPoints, money, negateMoney } from '@/lib/money';
import type { ApprovedSettlement } from '@/lib/allocation';
import type { CashEvent, Settlement, SettlementLine, SettlementLinePayout } from '@/types/domain';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';

const SETTLED_OPPORTUNITY_ID = 'f0000000-0000-4000-8000-000000000002';
const ORIGINAL_SETTLEMENT_ID = '20000000-0000-4000-8000-000000000002';
const MEMBER_LINE_ID = '40000000-0000-4000-8000-000000000003';

function withPaidMemberAndReversal(reissue: boolean): SyntheticDataset {
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
        id: '20000000-0000-4000-8000-000000000100',
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
          sequence: index + 1,
        }));

  return {
    ...original,
    cashEvents: [...original.cashEvents, payoutEvent],
    settlements: [
      ...original.settlements,
      reversal,
      ...(reissuedSettlement === null ? [] : [reissuedSettlement]),
    ],
    settlementLines: [...original.settlementLines, ...reversalLines, ...reissuedLines],
    settlementLinePayouts: [...original.settlementLinePayouts, memberPayout],
  };
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
    };

    const home = buildPersonalHome(dataset, PROTOTYPE_MEMBER);
    const settled = home.assignments.filter((entry) => entry.opportunityId === opportunityId);

    expect(settled).toHaveLength(2);
    expect(settled.map((entry) => entry.roleLabel).sort()).toEqual([
      'Cierre',
      'Producción audiovisual',
    ]);
    expect(settled.map((entry) => entry.money.amount.amount).sort((a, b) => a - b)).toEqual([
      179_454, 179_454,
    ]);
    expect(home.money.approved.amount).toBe(358_908);
    expect(home.money.paid.amount).toBe(229_454);
    expect(home.money.approvedUnpaid.amount).toBe(129_454);
    expect(home.money.recovery.amount).toBe(0);
  });

  it('preserves paid cash and exposes recovery after an approved settlement reversal', () => {
    const dataset = withPaidMemberAndReversal(false);
    const home = buildPersonalHome(dataset, PROTOTYPE_MEMBER);
    const finance = buildFinanceOverview(dataset, PROTOTYPE_FOUNDER);
    const reversedRow = finance.rows.find((row) => row.opportunity.id === SETTLED_OPPORTUNITY_ID);

    expect(home.money.approved.amount).toBe(0);
    expect(home.money.paid.amount).toBe(179_454);
    expect(home.money.approvedUnpaid.amount).toBe(0);
    expect(home.money.recovery.amount).toBe(179_454);
    expect(reversedRow?.rail.kind).toBe('projection');
    expect(finance.totals.paidOut.amount).toBeGreaterThanOrEqual(628_089);
    expect(finance.totals.recovery.amount).toBe(628_089);
    expect(finance.totals.owed.amount).toBeGreaterThanOrEqual(0);
  });

  it('keeps historical paid cash while a corrected reissue restores current approval', () => {
    const dataset = withPaidMemberAndReversal(true);
    const home = buildPersonalHome(dataset, PROTOTYPE_MEMBER);
    const finance = buildFinanceOverview(dataset, PROTOTYPE_FOUNDER);
    const reissuedRow = finance.rows.find((row) => row.opportunity.id === SETTLED_OPPORTUNITY_ID);

    expect(home.money.approved.amount).toBe(179_454);
    expect(home.money.paid.amount).toBe(179_454);
    expect(home.money.approvedUnpaid.amount).toBe(0);
    expect(home.money.recovery.amount).toBe(0);
    expect(reissuedRow?.rail.kind).toBe('settlement');
    expect(finance.totals.recovery.amount).toBe(0);
  });
});
