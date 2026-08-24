import { compareMoney } from '@/lib/money';
import { DataError } from '@/lib/result';
import type { ViewerContext } from '@/lib/viewer';
import type { LeaderboardRepository } from '@/data/repositories/leaderboard';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import {
  activeApprovedLinesFor,
  approvedEarnings,
  paidEarnings,
  payoutStatusFor,
  projectedEarnings,
  statsFor,
} from '@/data/repositories/synthetic/shared';
import type { LeaderboardProvenance, LeaderboardRow, ProvenanceEntry } from '@/types/views';

export const syntheticLeaderboardRepository: LeaderboardRepository = {
  async list(_viewer: ViewerContext): Promise<LeaderboardRow[]> {
    const dataset = loadSyntheticDataset();

    const unranked = [...dataset.members.values()].map((member) => {
      const stats = statsFor(dataset, member.id);
      return {
        memberId: member.id,
        slug: member.slug,
        displayName: member.displayName,
        initials: member.initials,
        approvedEarnings: approvedEarnings(dataset, member.id),
        paidEarnings: paidEarnings(dataset, member.id),
        projectedEarnings: projectedEarnings(dataset, member.id),
        closed: stats.closed,
        delivered: stats.delivered,
        onTimeRateBp: stats.onTimeRateBp,
      };
    });

    // Ranked on approved earnings alone. Projections are carried for context and
    // deliberately excluded from the comparison.
    unranked.sort(
      (a, b) =>
        compareMoney(b.approvedEarnings, a.approvedEarnings) ||
        b.closed - a.closed ||
        a.displayName.localeCompare(b.displayName, 'es-MX'),
    );

    return unranked.map((row, index) => ({ rank: index + 1, ...row }));
  },

  async getProvenance(slug: string, _viewer: ViewerContext): Promise<LeaderboardProvenance | null> {
    const dataset = loadSyntheticDataset();
    const member = [...dataset.members.values()].find((entry) => entry.slug === slug);
    if (member === undefined) return null;

    // Only the currently active, unreversed approved original per
    // opportunity — a reversal's own lines and a reversed original's lines
    // are excluded from per-row display, even though both still contribute
    // to the signed approvedEarnings/paidEarnings totals above.
    const entries: ProvenanceEntry[] = activeApprovedLinesFor(dataset, member.id)
      .map((line) => {
        const settlement = dataset.settlements.find((entry) => entry.id === line.settlementId);
        if (settlement === undefined) {
          throw new DataError(`Settlement line ${line.id} references a missing settlement`);
        }
        const opportunity = dataset.opportunities.find(
          (entry) => entry.id === settlement.opportunityId,
        );
        if (opportunity === undefined) {
          throw new DataError(`Settlement ${settlement.id} references a missing opportunity`);
        }
        const project = dataset.projects.get(opportunity.projectId);
        const approverId = settlement.approvedByMemberId;
        const approver = approverId === null ? undefined : dataset.members.get(approverId);
        if (settlement.approvedAt === null || approver === undefined) {
          throw new DataError(`Settlement ${settlement.id} is missing approval provenance`);
        }

        return {
          settlementId: settlement.id,
          opportunityId: opportunity.id,
          opportunityCode: opportunity.code,
          beneficiaryName: opportunity.beneficiaryName,
          projectName: project?.name ?? '',
          roleLabel: line.roleLabel,
          amount: line.amount,
          payoutStatus: payoutStatusFor(dataset, line),
          approvedAt: settlement.approvedAt,
          approvedByName: approver.displayName,
        };
      })
      .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));

    return {
      memberId: member.id,
      displayName: member.displayName,
      initials: member.initials,
      approvedEarnings: approvedEarnings(dataset, member.id),
      paidEarnings: paidEarnings(dataset, member.id),
      entries,
    };
  },
};
