import { describe, expect, it } from 'vitest';

import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import { syntheticHomeRepository } from '@/data/repositories/synthetic/home';
import { addMoney } from '@/lib/money';

const founderHome = await syntheticHomeRepository.getPersonalHome(PROTOTYPE_FOUNDER);
const memberHome = await syntheticHomeRepository.getPersonalHome(PROTOTYPE_MEMBER);

describe('personal home, founder viewer', () => {
  it('resolves the viewer to a real member record', () => {
    expect(founderHome.member.displayName).toBe('Luis Ramírez');
    expect(founderHome.member.role).toBe('founder');
  });

  it('reports zero approved money, because no settlement has paid this member', () => {
    expect(founderHome.money.approved.amount).toBe(0);
    expect(founderHome.money.paid.amount).toBe(0);
    expect(founderHome.money.approvedUnpaid.amount).toBe(0);
    expect(founderHome.money.recovery.amount).toBe(0);
  });

  it('reports projected money separately and never as earned', () => {
    // Closer on the delivered-but-unsettled opportunity: 20% of 897,270.
    expect(founderHome.money.projected.amount).toBe(179_454);
    expect(founderHome.assignments.every((entry) => entry.money.kind === 'projected')).toBe(true);
  });

  it('queues settlement approvals only for a founder', () => {
    const settle = founderHome.nextActions.filter((action) => action.key.startsWith('settle:'));
    expect(settle).toHaveLength(2);
    expect(settle.every((action) => action.tone === 'attention')).toBe(true);
  });
});

describe('personal home, member viewer', () => {
  it('resolves the viewer to a real member record', () => {
    expect(memberHome.member.displayName).toBe('Sebastián Benítez');
    expect(memberHome.member.role).toBe('member');
  });

  it('counts approved money only from an approved settlement line', () => {
    // One delivery line on the single approved settlement, still owed.
    expect(memberHome.money.approved.amount).toBe(179_454);
    expect(memberHome.money.paid.amount).toBe(0);
    expect(memberHome.money.approvedUnpaid.amount).toBe(179_454);
    expect(memberHome.money.recovery.amount).toBe(0);
  });

  it('keeps projected money out of approved money entirely', () => {
    // Closer on one opportunity (179,454) plus half a delivery pool (224,318).
    expect(memberHome.money.projected.amount).toBe(403_772);
    expect(memberHome.money.projected.amount).not.toBe(memberHome.money.approved.amount);
  });

  it('never lets projected money reach a payable total', () => {
    const payable = addMoney(memberHome.money.paid, memberHome.money.approvedUnpaid);
    expect(payable.amount).toBe(memberHome.money.approved.amount);
    // The projected figure is excluded from every total above.
    expect(payable.amount).toBeLessThan(
      memberHome.money.approved.amount + memberHome.money.projected.amount,
    );
  });

  it('labels each assignment row with its own money kind', () => {
    const kinds = memberHome.assignments.map((entry) => entry.money.kind).sort();
    expect(kinds).toEqual(['approved', 'projected', 'projected']);
  });

  it('never queues a settlement approval for a member', () => {
    expect(memberHome.nextActions.some((action) => action.key.startsWith('settle:'))).toBe(false);
  });

  it('counts active work excluding settled and paid opportunities', () => {
    expect(memberHome.activeWorkCount).toBe(2);
    const settled = memberHome.assignments.filter((entry) => !entry.active);
    expect(settled).toHaveLength(1);
    expect(settled[0]?.status).toBe('settled_approved');
  });
});

describe('personal home boundaries', () => {
  it('rejects a viewer who is not a member of the organization', async () => {
    await expect(
      syntheticHomeRepository.getPersonalHome({
        viewerId: 'b0000000-0000-4000-8000-0000000000ff',
        orgId: PROTOTYPE_FOUNDER.orgId,
        role: 'member',
      }),
    ).rejects.toThrow(/not a member/);
  });

  it('gives each viewer only their own assignments', () => {
    const founderOpportunities = founderHome.assignments.map((entry) => entry.opportunityId);
    const memberOpportunities = memberHome.assignments.map((entry) => entry.opportunityId);
    expect(founderOpportunities).toHaveLength(1);
    expect(memberOpportunities).toHaveLength(3);
    expect(new Set(memberOpportunities).size).toBe(3);
  });
});
