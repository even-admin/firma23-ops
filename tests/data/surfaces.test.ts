import { describe, expect, it } from 'vitest';

import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import { syntheticFinanceRepository } from '@/data/repositories/synthetic/finance';
import { syntheticMemberRepository } from '@/data/repositories/synthetic/members';
import { syntheticOpportunityRepository } from '@/data/repositories/synthetic/opportunities';
import { syntheticProjectRepository } from '@/data/repositories/synthetic/projects';
import { BASIS_POINTS_TOTAL } from '@/lib/money';
import { PermissionError } from '@/lib/viewer';

const SETY_SETTLED = 'f0000000-0000-4000-8000-000000000002';
const SETY_PROJECTED = 'f0000000-0000-4000-8000-000000000001';

describe('project repository', () => {
  it('summarises all three projects', async () => {
    const projects = await syntheticProjectRepository.list(PROTOTYPE_FOUNDER);
    expect(projects).toHaveLength(3);
  });

  it('counts only approved settlements toward a project total', async () => {
    const sety = await syntheticProjectRepository.getBySlug('sety-2026', PROTOTYPE_FOUNDER);
    // One approved settlement of 897,270 out of three opportunities.
    expect(sety?.approvedSettled.amount).toBe(897_270);
    expect(sety?.opportunityCount).toBe(3);
  });

  it('exposes each rule version as data, with its own base policy', async () => {
    const retainer = await syntheticProjectRepository.getBySlug(
      'ai-ops-retainer',
      PROTOTYPE_FOUNDER,
    );
    expect(retainer?.activeRule?.shares.map((share) => share.weightBp)).toEqual([
      2_500, 2_500, 5_000,
    ]);
    expect(retainer?.activeRule?.basePolicyLabel).toContain('aportación');
  });

  it('reports a draft project as genuinely empty', async () => {
    const draft = await syntheticProjectRepository.getBySlug(
      'even-internal-2026',
      PROTOTYPE_FOUNDER,
    );
    expect(draft?.services).toHaveLength(0);
    expect(draft?.rules).toHaveLength(0);
    expect(draft?.opportunities).toHaveLength(0);
    expect(draft?.activeRule).toBeNull();
    expect(draft?.approvedSettled.amount).toBe(0);
  });

  it('returns null for an unknown slug', async () => {
    expect(await syntheticProjectRepository.getBySlug('nope', PROTOTYPE_FOUNDER)).toBeNull();
  });
});

describe('opportunity detail', () => {
  it('is founder-only', async () => {
    await expect(
      syntheticOpportunityRepository.getById(SETY_SETTLED, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });

  it('materialises milestones in order with their evidence', async () => {
    const detail = await syntheticOpportunityRepository.getById(SETY_SETTLED, PROTOTYPE_FOUNDER);
    expect(detail?.milestones).toHaveLength(7);
    expect(detail?.milestones.map((m) => m.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(detail?.milestonesDone).toBe(7);
    expect(detail?.milestones.some((m) => m.evidence.length > 0)).toBe(true);
  });

  it('marks which cash events count toward the base', async () => {
    const detail = await syntheticOpportunityRepository.getById(SETY_PROJECTED, PROTOTYPE_FOUNDER);
    const inBase = detail?.cashEvents.filter((event) => event.countsTowardBase) ?? [];
    const outOfBase = detail?.cashEvents.filter((event) => !event.countsTowardBase) ?? [];
    // SETY counts the deposit only.
    expect(inBase).toHaveLength(1);
    expect(inBase[0]?.type).toBe('deposit');
    expect(outOfBase.some((event) => event.type === 'contribution')).toBe(true);
  });

  it('reports delivery weights totalling 10,000 basis points', async () => {
    const detail = await syntheticOpportunityRepository.getById(SETY_SETTLED, PROTOTYPE_FOUNDER);
    expect(detail?.deliveryWeightTotalBp).toBe(BASIS_POINTS_TOTAL);
  });

  it('returns null for an unknown opportunity', async () => {
    expect(
      await syntheticOpportunityRepository.getById(
        'f0000000-0000-4000-8000-0000000000ff',
        PROTOTYPE_FOUNDER,
      ),
    ).toBeNull();
  });
});

describe('member directory', () => {
  it('lists every operator with derived stats', async () => {
    const cards = await syntheticMemberRepository.listDirectory({}, PROTOTYPE_MEMBER);
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card.skills.length).toBeGreaterThan(0);
      expect(card.bio.length).toBeGreaterThan(0);
    }
  });

  it('shows approved earnings on a profile, never a projection', async () => {
    const profile = await syntheticMemberRepository.getProfileBySlug(
      'sebastian-benitez',
      PROTOTYPE_MEMBER,
    );
    expect(profile?.approvedEarnings.amount).toBe(179_454);
    expect(profile?.paidEarnings.amount).toBe(0);
    // The card carries no projected field at all.
    expect(profile).not.toHaveProperty('projectedEarnings');
  });

  it('labels recent work with its own money kind', async () => {
    const profile = await syntheticMemberRepository.getProfileBySlug(
      'sebastian-benitez',
      PROTOTYPE_MEMBER,
    );
    const kinds = profile?.recentWork.map((entry) => entry.money.kind).sort();
    expect(kinds).toEqual(['approved', 'projected', 'projected']);
  });

  it('filters by availability', async () => {
    const open = await syntheticMemberRepository.listDirectory(
      { availability: 'open' },
      PROTOTYPE_MEMBER,
    );
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((card) => card.availability === 'open')).toBe(true);
  });

  it('returns an empty list rather than everyone when a filter matches nothing', async () => {
    const none = await syntheticMemberRepository.listDirectory(
      { availability: 'nonsense' },
      PROTOTYPE_MEMBER,
    );
    expect(none).toHaveLength(0);
  });

  it('derives an on-time rate only when there is something to rate', async () => {
    const luis = await syntheticMemberRepository.getProfileBySlug('luis-ramirez', PROTOTYPE_MEMBER);
    const pablo = await syntheticMemberRepository.getProfileBySlug(
      'pablo-heisenberg',
      PROTOTYPE_MEMBER,
    );
    expect(luis?.stats.onTimeRateBp).toBeNull();
    expect(pablo?.stats.onTimeRateBp).toBe(5_000);
  });

  it('returns null for an unknown slug', async () => {
    expect(await syntheticMemberRepository.getProfileBySlug('nadie', PROTOTYPE_MEMBER)).toBeNull();
  });
});

describe('founder finance', () => {
  it('is founder-only', async () => {
    await expect(syntheticFinanceRepository.getOverview(PROTOTYPE_MEMBER)).rejects.toThrow(
      PermissionError,
    );
    await expect(
      syntheticFinanceRepository.getSettlementPreview(SETY_SETTLED, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });

  it('keeps approved and projected bases as separate totals', async () => {
    const overview = await syntheticFinanceRepository.getOverview(PROTOTYPE_FOUNDER);
    // Two approved settlements: 897,270 plus 2,500,000.
    expect(overview.totals.distributableApproved.amount).toBe(3_397_270);
    // Two projections, both SETY.
    expect(overview.totals.distributableProjected.amount).toBe(1_794_540);
    expect(overview.totals.distributableApproved.amount).not.toBe(
      overview.totals.distributableProjected.amount,
    );
  });

  it('reconciles paid plus owed against approved money', async () => {
    const overview = await syntheticFinanceRepository.getOverview(PROTOTYPE_FOUNDER);
    expect(overview.totals.paidOut.amount + overview.totals.owed.amount).toBe(
      overview.totals.distributableApproved.amount,
    );
  });

  it('counts pending approvals', async () => {
    const overview = await syntheticFinanceRepository.getOverview(PROTOTYPE_FOUNDER);
    expect(overview.pendingApprovals).toBe(2);
    expect(overview.rows).toHaveLength(4);
  });

  it('never offers an approval path in M1', async () => {
    const preview = await syntheticFinanceRepository.getSettlementPreview(
      SETY_PROJECTED,
      PROTOTYPE_FOUNDER,
    );
    expect(preview?.approvalBlockedReason).toContain('M2');
    expect(preview?.weightsBalanced).toBe(true);
  });

  it('reports outstanding milestones on the approval preview', async () => {
    const preview = await syntheticFinanceRepository.getSettlementPreview(
      SETY_PROJECTED,
      PROTOTYPE_FOUNDER,
    );
    // Opportunity one is mid-production, so it is not ready to settle.
    expect(preview?.milestonesOutstanding).toBeGreaterThan(0);
  });

  it('returns null for an unknown opportunity', async () => {
    expect(
      await syntheticFinanceRepository.getSettlementPreview(
        'f0000000-0000-4000-8000-0000000000ff',
        PROTOTYPE_FOUNDER,
      ),
    ).toBeNull();
  });
});
