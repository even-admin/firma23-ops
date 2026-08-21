import { describe, expect, it } from 'vitest';

import {
  AllocationError,
  buildApprovedSettlement,
  initialsFor,
  resolveAllocation,
  resolveDistributableBase,
  totalCashReceived,
} from '@/lib/allocation';
import { basisPoints, money, sumMoney } from '@/lib/money';
import type {
  AllocationRuleVersion,
  Assignment,
  CashEvent,
  Member,
  Organization,
  Settlement,
  SettlementLine,
} from '@/types/domain';

const EVEN: Organization = { id: 'org-even', slug: 'even', name: 'EVEN' };

const founder: Member = {
  id: 'm-founder',
  slug: 'luis-ramirez',
  displayName: 'Luis Ramírez',
  initials: 'LR',
  role: 'founder',
  orgId: 'org-firma23',
};

function member(id: string, displayName: string, initials: string): Member {
  return { id, slug: id, displayName, initials, role: 'member', orgId: 'org-firma23' };
}

const members = new Map<string, Member>([
  [founder.id, founder],
  ['m-closer', member('m-closer', 'Sebastián Benítez', 'SB')],
  ['m-video', member('m-video', 'Emiliano Pasos', 'EP')],
  ['m-design', member('m-design', 'Pablo Heisenberg', 'PH')],
  ['m-copy', member('m-copy', 'Diego Martínez Hernández', 'DMN')],
]);

const organizations = new Map<string, Organization>([[EVEN.id, EVEN]]);

/** The SETY rule, expressed the way the fixture expresses it. */
const setyRule: AllocationRuleVersion = {
  id: 'rule-sety-v1',
  projectId: 'project-sety',
  version: 1,
  effectiveFrom: '2026-01-15',
  currency: 'MXN',
  immutable: true,
  basePolicy: {
    kind: 'cash_event_types',
    includeTypes: ['deposit'],
    label: 'Depósito Secretaría únicamente',
    note: 'La contribución del beneficiario queda fuera de la base distribuible.',
  },
  shares: [
    {
      key: 'house',
      kind: 'house',
      label: 'Casa',
      weightBp: basisPoints(3_000),
      recipientOrgId: EVEN.id,
    },
    {
      key: 'closer',
      kind: 'closer',
      label: 'Cierre',
      weightBp: basisPoints(2_000),
      recipientOrgId: null,
    },
    {
      key: 'delivery',
      kind: 'delivery_pool',
      label: 'Producción',
      weightBp: basisPoints(5_000),
      recipientOrgId: null,
    },
  ],
};

/** A different project's rule, to prove the engine holds no project constants. */
const retainerRule: AllocationRuleVersion = {
  ...setyRule,
  id: 'rule-retainer-v1',
  projectId: 'project-retainer',
  shares: [
    {
      key: 'house',
      kind: 'house',
      label: 'Casa',
      weightBp: basisPoints(2_500),
      recipientOrgId: EVEN.id,
    },
    {
      key: 'closer',
      kind: 'closer',
      label: 'Cierre',
      weightBp: basisPoints(2_500),
      recipientOrgId: null,
    },
    {
      key: 'delivery',
      kind: 'delivery_pool',
      label: 'Producción',
      weightBp: basisPoints(5_000),
      recipientOrgId: null,
    },
  ],
};

const setyCashEvents: CashEvent[] = [
  {
    id: 'ce-1',
    opportunityId: 'opp-1',
    type: 'invoice',
    label: 'Factura',
    amount: money(1_000_000),
    occurredAt: '2026-07-30',
  },
  {
    id: 'ce-2',
    opportunityId: 'opp-1',
    type: 'withholding',
    label: 'ISR',
    amount: money(-10_776),
    occurredAt: '2026-07-30',
  },
  {
    id: 'ce-3',
    opportunityId: 'opp-1',
    type: 'withholding',
    label: 'IVA',
    amount: money(-91_954),
    occurredAt: '2026-07-30',
  },
  {
    id: 'ce-4',
    opportunityId: 'opp-1',
    type: 'deposit',
    label: 'Depósito',
    amount: money(897_270),
    occurredAt: '2026-08-07',
  },
  {
    id: 'ce-5',
    opportunityId: 'opp-1',
    type: 'contribution',
    label: 'Contribución',
    amount: money(160_000),
    occurredAt: '2026-08-02',
  },
];

const deliveryAssignments: Assignment[] = [
  {
    id: 'a-video',
    opportunityId: 'opp-1',
    memberId: 'm-video',
    roleKey: 'delivery',
    roleLabel: 'Producción audiovisual',
    weightBp: basisPoints(4_000),
    status: 'approved',
  },
  {
    id: 'a-design',
    opportunityId: 'opp-1',
    memberId: 'm-design',
    roleKey: 'delivery',
    roleLabel: 'Diseño gráfico',
    weightBp: basisPoints(3_500),
    status: 'approved',
  },
  {
    id: 'a-copy',
    opportunityId: 'opp-1',
    memberId: 'm-copy',
    roleKey: 'delivery',
    roleLabel: 'Copy y guion',
    weightBp: basisPoints(2_500),
    status: 'approved',
  },
];

const closerAssignment: Assignment = {
  id: 'a-closer',
  opportunityId: 'opp-1',
  memberId: 'm-closer',
  roleKey: 'closer',
  roleLabel: 'Cierre',
  weightBp: basisPoints(10_000),
  status: 'approved',
};

const fullAssignments: Assignment[] = [closerAssignment, ...deliveryAssignments];

function projection(assignments: readonly Assignment[], rule = setyRule) {
  const base = resolveDistributableBase(rule.basePolicy, setyCashEvents, 'MXN');
  return resolveAllocation({
    ruleVersion: rule,
    base: base.base,
    basePolicyLabel: base.policyLabel,
    assignments,
    members,
    organizations,
    unassignedLabel: 'Sin asignar',
  });
}

describe('resolveDistributableBase', () => {
  it('uses only the sponsor deposit for SETY, as the policy data says', () => {
    const result = resolveDistributableBase(setyRule.basePolicy, setyCashEvents, 'MXN');
    expect(result.base.amount).toBe(897_270);
  });

  it('excludes the beneficiary contribution from the base while still recording it', () => {
    const result = resolveDistributableBase(setyRule.basePolicy, setyCashEvents, 'MXN');
    expect(result.excluded.map((event) => event.id)).toContain('ce-5');
    expect(result.included).toHaveLength(1);
    expect(result.policyNote).toContain('fuera de la base distribuible');
  });

  it('reports cash received separately, which is a larger number', () => {
    expect(totalCashReceived(setyCashEvents, 'MXN').amount).toBe(1_057_270);
  });

  it('follows a different policy without any code change', () => {
    const bothPolicy = {
      ...setyRule.basePolicy,
      includeTypes: ['deposit', 'contribution'] as const,
    };
    expect(resolveDistributableBase(bothPolicy, setyCashEvents, 'MXN').base.amount).toBe(1_057_270);
  });

  it('rejects a negative base', () => {
    const events: CashEvent[] = [
      {
        id: 'ce-x',
        opportunityId: 'opp-1',
        type: 'deposit',
        label: 'Reverso',
        amount: money(-1),
        occurredAt: '2026-08-07',
      },
    ];
    expect(() => resolveDistributableBase(setyRule.basePolicy, events, 'MXN')).toThrow(
      AllocationError,
    );
  });
});

describe('resolveAllocation', () => {
  it('produces the confirmed SETY 30/20/50 split', () => {
    const result = projection(fullAssignments);
    expect(result.base.amount).toBe(897_270);
    expect(result.segments.map((segment) => [segment.key, segment.amount.amount])).toEqual([
      ['house', 269_181],
      ['closer', 179_454],
      ['delivery', 448_635],
    ]);
  });

  it('sums exactly to the distributable base', () => {
    const result = projection(fullAssignments);
    expect(sumMoney(result.segments.map((segment) => segment.amount)).amount).toBe(897_270);
  });

  it('splits the delivery pool by weight with no lost centavo', () => {
    const delivery = projection(fullAssignments).segments[2];
    expect(delivery?.participants.map((participant) => participant.amount.amount)).toEqual([
      179_454, 157_022, 112_159,
    ]);
    expect(
      sumMoney(delivery?.participants.map((participant) => participant.amount) ?? []).amount,
    ).toBe(448_635);
  });

  it('is always a projection, never carrying approval provenance', () => {
    const result = projection(fullAssignments);
    expect(result.kind).toBe('projection');
    expect(result).not.toHaveProperty('settlementId');
    expect(result).not.toHaveProperty('approvedAt');
  });

  it('resolves the house share to its recipient organization', () => {
    const house = projection(fullAssignments).segments[0];
    expect(house?.participants[0]?.displayName).toBe('EVEN');
    expect(house?.participants[0]?.memberId).toBeNull();
  });

  it('flags incomplete assignment instead of inventing a recipient', () => {
    const result = projection([closerAssignment]);
    expect(result.fullyAssigned).toBe(false);
    expect(result.segments[2]?.participants).toHaveLength(0);
    // The unassigned pool amount still belongs to the base.
    expect(sumMoney(result.segments.map((segment) => segment.amount)).amount).toBe(897_270);
  });

  it('produces different numbers for a different project rule', () => {
    const result = projection(fullAssignments, retainerRule);
    expect(result.segments.map((segment) => segment.amount.amount)).toEqual([
      224_318, 224_317, 448_635,
    ]);
    expect(sumMoney(result.segments.map((segment) => segment.amount)).amount).toBe(897_270);
  });

  it('rejects a rule whose shares do not total 10,000 basis points', () => {
    const broken: AllocationRuleVersion = {
      ...setyRule,
      shares: [setyRule.shares[0], setyRule.shares[1]].filter(
        (share): share is NonNullable<typeof share> => share !== undefined,
      ),
    };
    expect(() => projection(fullAssignments, broken)).toThrow(/shares total 5000 basis points/);
  });

  it('rejects delivery weights that do not total 10,000 basis points', () => {
    const bad = deliveryAssignments.slice(0, 2);
    expect(() => projection([closerAssignment, ...bad])).toThrow(/must total 10000 basis points/);
  });

  it('rejects an assignment pointing at an unknown member', () => {
    const ghost: Assignment = { ...closerAssignment, id: 'a-ghost', memberId: 'm-missing' };
    expect(() => projection([ghost, ...deliveryAssignments])).toThrow(/unknown member/);
  });

  it('rejects a house share with no resolvable organization', () => {
    const orphan: AllocationRuleVersion = {
      ...setyRule,
      shares: setyRule.shares.map((share) =>
        share.kind === 'house' ? { ...share, recipientOrgId: null } : share,
      ),
    };
    expect(() => projection(fullAssignments, orphan)).toThrow(/recipient organization/);
  });
});

const approvedSettlement: Settlement = {
  id: 'settle-1',
  opportunityId: 'opp-2',
  allocationRuleVersionId: setyRule.id,
  status: 'approved',
  base: money(897_270),
  approvedAt: '2026-08-12T17:40:00.000Z',
  approvedByMemberId: founder.id,
};

function line(
  id: string,
  shareKey: string,
  amount: number,
  sequence: number,
  overrides: Partial<SettlementLine> = {},
): SettlementLine {
  return {
    id,
    settlementId: approvedSettlement.id,
    shareKey,
    recipientKind:
      shareKey === 'house' ? 'house' : shareKey === 'closer' ? 'closer' : 'delivery_pool',
    recipientLabel: 'Recipiente',
    memberId: null,
    roleLabel: 'Rol',
    weightBp: basisPoints(10_000),
    amount: money(amount),
    payoutStatus: 'unpaid',
    paidAt: null,
    payoutCashEventId: null,
    sequence,
    ...overrides,
  };
}

const approvedLines: SettlementLine[] = [
  line('l-1', 'house', 269_181, 1, {
    payoutStatus: 'paid',
    paidAt: '2026-08-14',
    recipientLabel: 'EVEN',
  }),
  line('l-2', 'closer', 179_454, 2, {
    payoutStatus: 'paid',
    paidAt: '2026-08-14',
    recipientLabel: 'Emiliano Pasos',
  }),
  line('l-3', 'delivery', 179_454, 3, {
    weightBp: basisPoints(4_000),
    recipientLabel: 'Sebastián Benítez',
  }),
  line('l-4', 'delivery', 157_022, 4, {
    weightBp: basisPoints(3_500),
    recipientLabel: 'Pablo Heisenberg',
  }),
  line('l-5', 'delivery', 112_159, 5, {
    weightBp: basisPoints(2_500),
    recipientLabel: 'Diego Martínez Hernández',
  }),
];

function settled(
  settlement: Settlement = approvedSettlement,
  lines: readonly SettlementLine[] = approvedLines,
  approver: Member = founder,
) {
  return buildApprovedSettlement({
    settlement,
    lines,
    ruleVersion: setyRule,
    basePolicyLabel: setyRule.basePolicy.label,
    approver,
  });
}

describe('buildApprovedSettlement', () => {
  it('cannot be built from a pending settlement', () => {
    const pending: Settlement = {
      ...approvedSettlement,
      status: 'pending',
      approvedAt: null,
      approvedByMemberId: null,
    };
    expect(() => settled(pending, [])).toThrow(/only approved settlements produce settled money/);
  });

  it('refuses an approved settlement missing approval provenance', () => {
    expect(() => settled({ ...approvedSettlement, approvedAt: null })).toThrow(
      /missing approval provenance/,
    );
  });

  it('refuses approval by a non-founder', () => {
    const operator = member('m-closer', 'Sebastián Benítez', 'SB');
    expect(() =>
      settled({ ...approvedSettlement, approvedByMemberId: operator.id }, approvedLines, operator),
    ).toThrow(/non-founder/);
  });

  it('refuses an approver that does not match the record', () => {
    const otherFounder: Member = { ...founder, id: 'm-other-founder' };
    expect(() => settled(approvedSettlement, approvedLines, otherFounder)).toThrow(
      /approver mismatch/,
    );
  });

  it('carries approval provenance and settled segments', () => {
    const result = settled();
    expect(result.kind).toBe('settlement');
    expect(result.settlementId).toBe('settle-1');
    expect(result.approvedAt).toBe('2026-08-12T17:40:00.000Z');
    expect(result.approvedByDisplayName).toBe('Luis Ramírez');
    expect(result.segments.map((segment) => segment.amount.amount)).toEqual([
      269_181, 179_454, 448_635,
    ]);
  });

  it('reports paid and unpaid separately, both inside approved money', () => {
    const result = settled();
    expect(result.paid.amount).toBe(448_635);
    expect(result.unpaid.amount).toBe(448_635);
    expect(result.paid.amount + result.unpaid.amount).toBe(result.base.amount);
  });

  it('orders lines by their append-only sequence', () => {
    const shuffled = [...approvedLines].reverse();
    const result = settled(approvedSettlement, shuffled);
    expect(result.segments[2]?.participants.map((participant) => participant.lineId)).toEqual([
      'l-3',
      'l-4',
      'l-5',
    ]);
  });

  it('rejects lines that do not sum to the approved base', () => {
    const short = approvedLines.slice(0, 4);
    expect(() => settled(approvedSettlement, short)).toThrow(/but the base is 897270/);
  });

  it('rejects a settlement with no lines', () => {
    expect(() => settled(approvedSettlement, [])).toThrow(/has no lines/);
  });

  it('rejects lines belonging to another settlement', () => {
    const foreign = [
      ...approvedLines,
      line('l-x', 'house', 0, 6, { settlementId: 'settle-other' }),
    ];
    expect(() => settled(approvedSettlement, foreign)).toThrow(/from another settlement/);
  });

  it('rejects lines for a share the rule version does not define', () => {
    const unknown = [...approvedLines.slice(0, 4), line('l-5b', 'bonus', 112_159, 5)];
    expect(() => settled(approvedSettlement, unknown)).toThrow(/absent from rule/);
  });

  it('rejects a segment whose lines disagree with its total', () => {
    const rule: AllocationRuleVersion = { ...setyRule };
    expect(() =>
      buildApprovedSettlement({
        settlement: { ...approvedSettlement, base: money(897_271) },
        lines: approvedLines,
        ruleVersion: rule,
        basePolicyLabel: rule.basePolicy.label,
        approver: founder,
      }),
    ).toThrow(/but the base is 897271/);
  });

  it('rejects a rule whose shares are incomplete', () => {
    const broken: AllocationRuleVersion = { ...setyRule, shares: [setyRule.shares[0]!] };
    expect(() =>
      buildApprovedSettlement({
        settlement: approvedSettlement,
        lines: approvedLines,
        ruleVersion: broken,
        basePolicyLabel: broken.basePolicy.label,
        approver: founder,
      }),
    ).toThrow(/shares total 3000 basis points/);
  });
});

describe('initialsFor', () => {
  it('derives initials from a display name', () => {
    expect(initialsFor('EVEN')).toBe('E');
    expect(initialsFor('Sebastián Benítez')).toBe('SB');
    expect(initialsFor('Diego Martínez Hernández')).toBe('DH');
    expect(initialsFor('   ')).toBe('?');
  });
});
