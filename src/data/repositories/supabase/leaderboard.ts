import { compareMoney, sumMoney } from '@/lib/money';
import type { ViewerContext } from '@/lib/viewer';
import type { LeaderboardRepository } from '@/data/repositories/leaderboard';
import { loadOperationalSnapshot } from '@/data/repositories/supabase/operational-reads';
import type { LeaderboardProvenance, LeaderboardRow } from '@/types/views';

export const supabaseLeaderboardRepository: LeaderboardRepository = {
  async list(viewer: ViewerContext): Promise<LeaderboardRow[]> {
    const snapshot = await loadOperationalSnapshot(viewer);
    const rows = [...snapshot.members.values()]
      .filter((member) => member.role !== 'founder')
      .map((member) => {
        const activeLines = snapshot.settlementLines.filter((line) => {
          const settlement = snapshot.settlements.find((entry) => entry.id === line.settlementId);
          return line.memberId === member.id && settlement?.kind === 'original' && settlement.status === 'approved' && !snapshot.settlements.some((reversal) => reversal.kind === 'reversal' && reversal.status === 'approved' && reversal.correctsSettlementId === settlement.id);
        });
        const approvedEarnings = sumMoney(activeLines.map((line) => line.amount));
        const mayReadPrivateMoney = viewer.role === 'founder' || viewer.viewerId === member.id;
        return {
          memberId: member.id,
          slug: member.slug,
          displayName: member.displayName,
          initials: member.initials,
          approvedEarnings,
          ...(mayReadPrivateMoney
            ? { paidEarnings: sumMoney(snapshot.payouts.filter((payout) => activeLines.some((line) => line.id === payout.settlementLineId)).map((payout) => payout.amount)) }
            : {}),
          closed: 0,
          delivered: 0,
          onTimeRateBp: null,
        } satisfies Omit<LeaderboardRow, 'rank'>;
      })
      .sort((left, right) => compareMoney(right.approvedEarnings, left.approvedEarnings) || left.displayName.localeCompare(right.displayName, 'es-MX'));
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  },

  async getProvenance(slug: string, viewer: ViewerContext): Promise<LeaderboardProvenance | null> {
    const snapshot = await loadOperationalSnapshot(viewer);
    const member = [...snapshot.members.values()].find((entry) => entry.slug === slug);
    if (member === undefined || (viewer.role !== 'founder' && viewer.viewerId !== member.id)) return null;
    const entries = snapshot.settlementLines.flatMap((line) => {
      const settlement = snapshot.settlements.find((entry) => entry.id === line.settlementId);
      if (line.memberId !== member.id || settlement?.kind !== 'original' || settlement.status !== 'approved' || snapshot.settlements.some((reversal) => reversal.kind === 'reversal' && reversal.status === 'approved' && reversal.correctsSettlementId === settlement.id)) return [];
      const opportunity = snapshot.opportunities.find((entry) => entry.id === settlement.opportunityId);
      const project = opportunity === undefined ? undefined : snapshot.projects.get(opportunity.projectId);
      const approver = settlement.approvedByMemberId === null ? undefined : snapshot.members.get(settlement.approvedByMemberId);
      if (opportunity === undefined || project === undefined || approver === undefined || settlement.approvedAt === null) return [];
      const paid = sumMoney(snapshot.payouts.filter((payout) => payout.settlementLineId === line.id).map((payout) => payout.amount), line.amount.currency);
      return [{ settlementId: settlement.id, opportunityId: opportunity.id, opportunityCode: opportunity.code, beneficiaryName: opportunity.beneficiaryName, projectName: project.name, roleLabel: line.roleLabel, amount: line.amount, payoutStatus: paid.amount === 0 ? 'unpaid' as const : paid.amount === line.amount.amount ? 'paid' as const : 'partial' as const, approvedAt: settlement.approvedAt, approvedByName: approver.displayName }];
    });
    const entryLineIds = new Set(
      snapshot.settlementLines
        .filter((line) => entries.some((entry) => entry.settlementId === line.settlementId && entry.roleLabel === line.roleLabel && line.memberId === member.id))
        .map((line) => line.id),
    );
    return {
      memberId: member.id,
      displayName: member.displayName,
      initials: member.initials,
      approvedEarnings: sumMoney(entries.map((entry) => entry.amount)),
      paidEarnings: sumMoney(snapshot.payouts.filter((payout) => entryLineIds.has(payout.settlementLineId)).map((payout) => payout.amount)),
      entries,
    };
  },
};
