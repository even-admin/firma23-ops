import { describe, expect, it } from 'vitest';

import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import { BASIS_POINTS_TOTAL, sumMoney } from '@/lib/money';
import { PermissionError } from '@/lib/viewer';

const dataset = loadSyntheticDataset();

describe('fixture validation', () => {
  it('loads every fixture through its schema', () => {
    expect(dataset.organizations.size).toBeGreaterThan(0);
    expect(dataset.members.size).toBe(6);
    expect(dataset.projects.size).toBe(1);
    expect(dataset.serviceVersions.size).toBe(3);
    expect(dataset.allocationRuleVersions.size).toBe(1);
    expect(dataset.opportunities).toHaveLength(2);
  });

  it('memoises, so repeated loads are the same object', () => {
    expect(loadSyntheticDataset()).toBe(dataset);
  });

  it('keeps the SETY service catalogue as data, including the 24-deliverable kit', () => {
    const kit = [...dataset.serviceVersions.values()].find(
      (service) => service.key === 'social-content-kit',
    );
    expect(kit?.deliverablesSummary).toContain('24 entregables');
    expect(kit?.immutable).toBe(true);
  });
});

describe('referential integrity', () => {
  it('points every opportunity at an existing project, service version and rule version', () => {
    for (const opportunity of dataset.opportunities) {
      expect(dataset.projects.has(opportunity.projectId)).toBe(true);
      expect(dataset.serviceVersions.has(opportunity.serviceVersionId)).toBe(true);
      expect(dataset.allocationRuleVersions.has(opportunity.allocationRuleVersionId)).toBe(true);
    }
  });

  it('points every assignment at an existing member and opportunity', () => {
    const opportunityIds = new Set(dataset.opportunities.map((entry) => entry.id));
    for (const assignment of dataset.assignments) {
      expect(dataset.members.has(assignment.memberId)).toBe(true);
      expect(opportunityIds.has(assignment.opportunityId)).toBe(true);
    }
  });

  it('points every cash event and settlement at an existing opportunity', () => {
    const opportunityIds = new Set(dataset.opportunities.map((entry) => entry.id));
    for (const event of dataset.cashEvents) {
      expect(opportunityIds.has(event.opportunityId)).toBe(true);
    }
    for (const settlement of dataset.settlements) {
      expect(opportunityIds.has(settlement.opportunityId)).toBe(true);
      expect(dataset.allocationRuleVersions.has(settlement.allocationRuleVersionId)).toBe(true);
    }
  });

  it('never carries a settlement line without an approved settlement', () => {
    const approved = new Set(
      dataset.settlements.filter((entry) => entry.status === 'approved').map((entry) => entry.id),
    );
    expect(dataset.settlementLines.length).toBeGreaterThan(0);
    for (const line of dataset.settlementLines) {
      expect(approved.has(line.settlementId)).toBe(true);
    }
  });

  it('has a pending settlement carrying no lines at all', () => {
    const pending = dataset.settlements.filter((entry) => entry.status === 'pending');
    expect(pending).toHaveLength(1);
    for (const settlement of pending) {
      expect(
        dataset.settlementLines.filter((line) => line.settlementId === settlement.id),
      ).toHaveLength(0);
    }
  });

  it('totals every rule version to 10,000 basis points', () => {
    for (const rule of dataset.allocationRuleVersions.values()) {
      const total = rule.shares.reduce<number>((acc, share) => acc + share.weightBp, 0);
      expect(total).toBe(BASIS_POINTS_TOTAL);
    }
  });

  it('totals delivery weights to 10,000 basis points per opportunity', () => {
    for (const opportunity of dataset.opportunities) {
      const delivery = dataset.assignments.filter(
        (assignment) =>
          assignment.opportunityId === opportunity.id && assignment.roleKey === 'delivery',
      );
      const total = delivery.reduce<number>((acc, assignment) => acc + assignment.weightBp, 0);
      expect(total).toBe(BASIS_POINTS_TOTAL);
    }
  });

  it('sums approved settlement lines exactly to the approved base', () => {
    for (const settlement of dataset.settlements) {
      if (settlement.status !== 'approved') continue;
      const lines = dataset.settlementLines.filter((line) => line.settlementId === settlement.id);
      expect(sumMoney(lines.map((line) => line.amount)).amount).toBe(settlement.base.amount);
    }
  });

  it('keeps settlement line sequences unique and gapless', () => {
    for (const settlement of dataset.settlements) {
      const sequences = dataset.settlementLines
        .filter((line) => line.settlementId === settlement.id)
        .map((line) => line.sequence)
        .sort((a, b) => a - b);
      expect(sequences).toEqual(sequences.map((_, index) => index + 1));
    }
  });

  it('never records contact information for a member', () => {
    // Identity is a UUID. Display fields must carry no email, phone, or digits at all.
    for (const member of dataset.members.values()) {
      for (const field of [member.displayName, member.slug, member.initials]) {
        expect(field).not.toMatch(/@/);
        expect(field).not.toMatch(/\d/);
      }
    }
  });
});

describe('settlement repository', () => {
  it('returns one projected rail and one approved rail', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.rail.kind).sort()).toEqual(['projection', 'settlement']);
  });

  it('reports the confirmed SETY base and cash received on both opportunities', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    for (const card of cards) {
      expect(card.distributableBase.base.amount).toBe(897_270);
      expect(card.cashReceived.amount).toBe(1_057_270);
      expect(card.distributableBase.excluded.some((event) => event.type === 'contribution')).toBe(
        true,
      );
    }
  });

  it('resolves the approved rail with the confirmed 30/20/50 lines', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    const settled = cards.find((card) => card.rail.kind === 'settlement');
    expect(settled?.rail.segments.map((segment) => segment.amount.amount)).toEqual([
      269_181, 179_454, 448_635,
    ]);
  });

  it('returns null for an unknown opportunity', async () => {
    const result = await syntheticSettlementRepository.getOpportunityRail(
      'f0000000-0000-4000-8000-00000000ffff',
      PROTOTYPE_FOUNDER,
    );
    expect(result).toBeNull();
  });

  it('refuses a member viewer, because full financial detail is founder-only', async () => {
    await expect(
      syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
    await expect(
      syntheticSettlementRepository.getOpportunityRail(
        dataset.opportunities[0]?.id ?? '',
        PROTOTYPE_MEMBER,
      ),
    ).rejects.toThrow(PermissionError);
  });
});
