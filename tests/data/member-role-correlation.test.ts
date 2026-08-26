import { describe, expect, it } from 'vitest';

import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOperatorProfile } from '@/data/repositories/synthetic/members';
import { money } from '@/lib/money';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';

const MEMBER_ID = 'b0000000-0000-4000-8000-000000000003';
const OPPORTUNITY_ID = 'f0000000-0000-4000-8000-000000000002';
const SETTLEMENT_ID = '20000000-0000-4000-8000-000000000002';

function dualRoleDataset(): SyntheticDataset {
  const baseline = loadSyntheticDataset();

  return {
    ...baseline,
    assignments: baseline.assignments.map((assignment) =>
      assignment.opportunityId === OPPORTUNITY_ID && assignment.roleKey === 'closer'
        ? { ...assignment, memberId: MEMBER_ID }
        : assignment,
    ),
    settlementLines: baseline.settlementLines.map((line) => {
      if (line.settlementId !== SETTLEMENT_ID) return line;
      if (line.shareKey === 'closer') {
        return { ...line, memberId: MEMBER_ID, recipientLabel: 'Sebastián Benítez' };
      }
      if (line.shareKey === 'delivery' && line.memberId === MEMBER_ID) {
        return { ...line, amount: money(120_000) };
      }
      if (line.shareKey === 'house') {
        return { ...line, amount: money(line.amount.amount + 59_454) };
      }
      return line;
    }),
  };
}

describe('member profile settlement correlation', () => {
  it('matches unequal dual-role lines by role key and member id', () => {
    const profile = buildOperatorProfile(dualRoleDataset(), 'sebastian-benitez');
    const rows = profile?.recentWork.filter((work) => work.opportunityId === OPPORTUNITY_ID);
    const closer = rows?.find((work) => work.roleLabel === 'Cierre');
    const delivery = rows?.find((work) => work.roleLabel === 'Producción audiovisual');

    expect(closer?.money).toMatchObject({
      kind: 'approved',
      amount: { amount: 179_454, currency: 'MXN' },
      payoutStatus: 'paid',
    });
    expect(delivery?.money).toMatchObject({
      kind: 'approved',
      amount: { amount: 120_000, currency: 'MXN' },
      payoutStatus: 'unpaid',
    });
  });
});
