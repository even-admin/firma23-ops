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
    expect(dataset.projects.size).toBe(3);
    expect(dataset.serviceVersions.size).toBe(5);
    expect(dataset.allocationRuleVersions.size).toBe(2);
    expect(dataset.opportunities).toHaveLength(4);
    expect(dataset.skills.size).toBe(22);
    expect(dataset.memberProfiles.size).toBe(6);
    expect(dataset.sourceDocuments.size).toBe(1);
    expect(dataset.aiContractDrafts.size).toBe(1);
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

  it('has pending settlements carrying no lines at all', () => {
    const pending = dataset.settlements.filter((entry) => entry.status === 'pending');
    expect(pending).toHaveLength(2);
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
  it('returns a rail per opportunity, projected until a founder approves', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.rail.kind).sort()).toEqual([
      'projection',
      'projection',
      'settlement',
      'settlement',
    ]);
  });

  it('reports the confirmed SETY base on every SETY opportunity', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    const sety = cards.filter((card) => card.opportunity.projectSlug === 'sety-2026');
    expect(sety).toHaveLength(3);
    for (const card of sety) {
      expect(card.distributableBase.base.amount).toBe(897_270);
      expect(card.cashReceived.amount).toBe(1_057_270);
      // SETY excludes the beneficiary contribution from the base.
      expect(card.distributableBase.excluded.some((event) => event.type === 'contribution')).toBe(
        true,
      );
    }
  });

  it('resolves the approved rail with the confirmed 30/20/50 lines', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    const settled = cards.find((card) => card.rail.kind === 'settlement');
    if (settled?.rail.kind !== 'settlement') throw new Error('expected an approved settlement');
    expect(settled.rail.segments.map((segment) => segment.amount.amount)).toEqual([
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

describe('project agnosticism', () => {
  it('runs three projects with different states', () => {
    const slugs = [...dataset.projects.values()].map((project) => project.slug).sort();
    expect(slugs).toEqual(['ai-ops-retainer', 'even-internal-2026', 'sety-2026']);
    const statuses = [...dataset.projects.values()].map((project) => project.status).sort();
    expect(statuses).toEqual(['active', 'active', 'draft']);
  });

  it('gives the draft project no service versions, rules or opportunities', () => {
    const draft = [...dataset.projects.values()].find((project) => project.status === 'draft');
    expect(draft?.activeAllocationRuleVersionId).toBeNull();
    expect(
      [...dataset.serviceVersions.values()].filter((entry) => entry.projectId === draft?.id),
    ).toHaveLength(0);
    expect(dataset.opportunities.filter((entry) => entry.projectId === draft?.id)).toHaveLength(0);
  });

  it('derives a different base from a different base policy, with no code change', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    const retainer = cards.find((card) => card.opportunity.projectSlug === 'ai-ops-retainer');
    // This project distributes the client contribution; SETY does not.
    expect(retainer?.distributableBase.base.amount).toBe(2_500_000);
    expect(retainer?.cashReceived.amount).toBe(2_500_000);
    expect(retainer?.distributableBase.included).toHaveLength(2);
  });

  it('derives a different split from a different rule, with no code change', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    const retainer = cards.find((card) => card.opportunity.projectSlug === 'ai-ops-retainer');
    // 25/25/50 rather than SETY's 30/20/50.
    if (retainer?.rail.kind !== 'settlement') throw new Error('expected an approved settlement');
    expect(retainer.rail.segments.map((segment) => segment.amount.amount)).toEqual([
      625_000, 625_000, 1_250_000,
    ]);
  });

  it('reports a fully paid settlement, a state SETY has not reached', async () => {
    const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
    const retainer = cards.find((card) => card.opportunity.projectSlug === 'ai-ops-retainer');
    if (retainer?.rail.kind !== 'settlement') throw new Error('expected an approved settlement');
    expect(retainer.rail.paid.amount).toBe(2_500_000);
    expect(retainer.rail.unpaid.amount).toBe(0);
  });

  it('never lets one project rule leak into another', () => {
    const rules = [...dataset.allocationRuleVersions.values()];
    const weights = rules.map((rule) => rule.shares.map((share) => share.weightBp));
    expect(weights).toEqual([
      [3_000, 2_000, 5_000],
      [2_500, 2_500, 5_000],
    ]);
    expect(new Set(rules.map((rule) => rule.projectId)).size).toBe(2);
  });
});

describe('milestones, evidence and the member layer', () => {
  it('materialises milestones from a service version template', () => {
    const setyKit = dataset.milestoneTemplates.filter(
      (template) => template.serviceVersionId === 'd0000000-0000-4000-8000-000000000003',
    );
    expect(setyKit).toHaveLength(7);
    for (const milestone of dataset.opportunityMilestones) {
      expect(dataset.milestoneTemplates.some((t) => t.id === milestone.templateId)).toBe(true);
    }
  });

  it('attaches every evidence link to a real milestone and submitter', () => {
    expect(dataset.evidenceLinks.length).toBeGreaterThan(0);
    for (const link of dataset.evidenceLinks) {
      expect(dataset.opportunityMilestones.some((m) => m.id === link.opportunityMilestoneId)).toBe(
        true,
      );
      expect(dataset.members.has(link.submittedByMemberId)).toBe(true);
    }
  });

  it('keeps every evidence and portfolio URL on a reserved test host', () => {
    for (const url of [
      ...dataset.evidenceLinks.map((link) => link.url),
      ...dataset.portfolioItems.map((item) => item.url),
    ]) {
      expect(url).toMatch(/^https:\/\/[a-z0-9.-]+\.test\//);
    }
  });

  it('points every member skill and portfolio item at a real member', () => {
    for (const entry of dataset.memberSkills) {
      expect(dataset.members.has(entry.memberId)).toBe(true);
      expect(dataset.skills.has(entry.skillId)).toBe(true);
    }
    for (const item of dataset.portfolioItems) {
      expect(dataset.members.has(item.memberId)).toBe(true);
    }
  });

  it('gives every member a profile', () => {
    for (const member of dataset.members.values()) {
      expect(dataset.memberProfiles.has(member.id)).toBe(true);
    }
  });

  it('points every stat event at a real member and opportunity', () => {
    const opportunityIds = new Set(dataset.opportunities.map((entry) => entry.id));
    expect(dataset.statEvents.length).toBeGreaterThan(0);
    for (const event of dataset.statEvents) {
      expect(dataset.members.has(event.memberId)).toBe(true);
      expect(opportunityIds.has(event.opportunityId)).toBe(true);
    }
  });
});

describe('document-first contract intake fixtures', () => {
  it('points every AI contract draft at a real source document', () => {
    for (const draft of dataset.aiContractDrafts.values()) {
      expect(dataset.sourceDocuments.has(draft.sourceDocumentId)).toBe(true);
    }
  });

  it('never matches a project, service version, or rule version that does not exist', () => {
    for (const draft of dataset.aiContractDrafts.values()) {
      if (draft.matchedProjectId !== null) {
        expect(dataset.projects.has(draft.matchedProjectId)).toBe(true);
      }
      for (const serviceId of draft.matchedServiceVersionIds) {
        expect(dataset.serviceVersions.has(serviceId)).toBe(true);
      }
      if (draft.matchedAllocationRuleVersionId !== null) {
        expect(dataset.allocationRuleVersions.has(draft.matchedAllocationRuleVersionId)).toBe(true);
      }
    }
  });

  it('carries at least one evidence entry for every extracted field', () => {
    for (const draft of dataset.aiContractDrafts.values()) {
      expect(draft.sponsorName.evidence.length).toBeGreaterThan(0);
      expect(draft.programName.evidence.length).toBeGreaterThan(0);
      expect(draft.exampleDistributableBase.evidence.length).toBeGreaterThan(0);
    }
  });
});
