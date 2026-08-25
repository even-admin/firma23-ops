import { describe, expect, it } from 'vitest';

import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import { syntheticLeaderboardRepository } from '@/data/repositories/synthetic/leaderboard';
import { compareMoney, money } from '@/lib/money';

const rows = await syntheticLeaderboardRepository.list(PROTOTYPE_FOUNDER);

describe('leaderboard ranking', () => {
  it('ranks every eligible member exactly once and excludes founders', () => {
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    expect(rows.map((row) => row.slug)).not.toContain('luis-ramirez');
    expect(rows.map((row) => row.slug)).not.toContain('diego-martinez-herrera');
  });

  it('orders by approved earnings, descending', () => {
    for (let i = 1; i < rows.length; i += 1) {
      const previous = rows[i - 1];
      const current = rows[i];
      if (previous === undefined || current === undefined) throw new Error('missing row');
      expect(
        compareMoney(previous.approvedEarnings, current.approvedEarnings),
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not rank by projected earnings', () => {
    const projectedRows = rows.map((row) => ({
      ...row,
      projectedEarnings: row.projectedEarnings ?? money(0),
    }));
    const projectedOrder = [...projectedRows]
      .sort((a, b) => compareMoney(b.projectedEarnings, a.projectedEarnings))
      .map((row) => row.memberId);
    expect(projectedRows.some((row) => row.projectedEarnings.amount > 0)).toBe(true);
    expect(rows.map((row) => row.memberId)).not.toEqual(projectedOrder);
  });

  it('never lets paid exceed approved', () => {
    for (const row of rows) {
      expect(row.paidEarnings?.amount ?? 0).toBeLessThanOrEqual(row.approvedEarnings.amount);
    }
  });

  it('carries projected earnings as a separate figure', () => {
    const projectedTotal = rows.reduce((acc, row) => acc + (row.projectedEarnings?.amount ?? 0), 0);
    const approvedTotal = rows.reduce((acc, row) => acc + row.approvedEarnings.amount, 0);
    expect(projectedTotal).toBeGreaterThan(0);
    expect(approvedTotal).toBeGreaterThan(0);
    expect(projectedTotal).not.toBe(approvedTotal);
  });

  it('breaks ties deterministically', async () => {
    const again = await syntheticLeaderboardRepository.list(PROTOTYPE_FOUNDER);
    expect(again.map((row) => row.memberId)).toEqual(rows.map((row) => row.memberId));
  });

  it('is readable by a member, not just a founder', async () => {
    const asMember = await syntheticLeaderboardRepository.list(PROTOTYPE_MEMBER);
    expect(asMember.map((row) => row.memberId)).toEqual(rows.map((row) => row.memberId));
  });

  it('omits teammate paid and projected figures for a member without zero-filling them', async () => {
    const asMember = await syntheticLeaderboardRepository.list(PROTOTYPE_MEMBER);
    const self = asMember.find((row) => row.memberId === PROTOTYPE_MEMBER.viewerId);
    expect(self).toHaveProperty('paidEarnings');
    expect(self).toHaveProperty('projectedEarnings');
    for (const teammate of asMember.filter((row) => row.memberId !== PROTOTYPE_MEMBER.viewerId)) {
      expect(teammate).not.toHaveProperty('paidEarnings');
      expect(teammate).not.toHaveProperty('projectedEarnings');
    }
  });

  it('keeps founders excluded for both viewer roles', async () => {
    const asMember = await syntheticLeaderboardRepository.list(PROTOTYPE_MEMBER);
    expect(
      asMember.every((row) => !['luis-ramirez', 'diego-martinez-herrera'].includes(row.slug)),
    ).toBe(true);
  });
});

describe('leaderboard provenance', () => {
  it('traces every centavo of approved money to an approved settlement line', async () => {
    for (const row of rows) {
      const provenance = await syntheticLeaderboardRepository.getProvenance(
        row.slug,
        PROTOTYPE_FOUNDER,
      );
      if (provenance === null) throw new Error(`no provenance for ${row.slug}`);

      const traced = provenance.entries.reduce((acc, entry) => acc + entry.amount.amount, 0);
      expect(traced).toBe(row.approvedEarnings.amount);
      expect(provenance.approvedEarnings.amount).toBe(row.approvedEarnings.amount);
    }
  });

  it('names the approving founder on every entry', async () => {
    const provenance = await syntheticLeaderboardRepository.getProvenance(
      'emiliano-pasos',
      PROTOTYPE_FOUNDER,
    );
    expect(provenance?.entries.length).toBeGreaterThan(0);
    for (const entry of provenance?.entries ?? []) {
      expect(entry.approvedByName).toBe('Luis Ramírez');
      expect(entry.approvedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });

  it('returns an empty trace rather than inventing one', async () => {
    const provenance = await syntheticLeaderboardRepository.getProvenance(
      'luis-ramirez',
      PROTOTYPE_FOUNDER,
    );
    // Luis approves settlements; he holds no settlement line of his own.
    expect(provenance?.entries).toHaveLength(0);
    expect(provenance?.approvedEarnings.amount).toBe(0);
  });

  it('returns null for an unknown member', async () => {
    expect(
      await syntheticLeaderboardRepository.getProvenance('nadie', PROTOTYPE_FOUNDER),
    ).toBeNull();
  });

  it('allows a member to inspect only their own line-level provenance', async () => {
    expect(
      await syntheticLeaderboardRepository.getProvenance('sebastian-benitez', PROTOTYPE_MEMBER),
    ).not.toBeNull();
    expect(
      await syntheticLeaderboardRepository.getProvenance('emiliano-pasos', PROTOTYPE_MEMBER),
    ).toBeNull();
  });
});
