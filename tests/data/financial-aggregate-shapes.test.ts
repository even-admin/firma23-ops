import { describe, expect, it } from 'vitest';

import { organizationRecipientApproved } from '@/data/repositories/synthetic/finance';
import { buildPersonalHome } from '@/data/repositories/synthetic/home';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import { basisPoints, money } from '@/lib/money';
import type { ApprovedSettlement } from '@/lib/allocation';

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
  });
});
