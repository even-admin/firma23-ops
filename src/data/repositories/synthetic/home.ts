import { copy } from '@/copy/es-MX';
import type { HomeRepository } from '@/data/repositories/home';
import type { AssignmentMoney, HomeAssignment, NextAction, PersonalHome } from '@/types/views';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOpportunityRail } from '@/data/repositories/synthetic/rails';
import { payoutAllocatedFor } from '@/data/repositories/synthetic/shared';
import { subMoney, sumMoney, zeroMoney, type Money } from '@/lib/money';
import { DataError } from '@/lib/result';
import { isFounder, type ViewerContext } from '@/lib/viewer';
import type { OpportunityStatus } from '@/types/domain';

const ACTIVE_STATUSES: readonly OpportunityStatus[] = [
  'draft',
  'assigned',
  'in_delivery',
  'delivered',
];

export function buildPersonalHome(dataset: SyntheticDataset, viewer: ViewerContext): PersonalHome {
  const member = dataset.members.get(viewer.viewerId);
  if (member === undefined) {
    throw new DataError(`Viewer ${viewer.viewerId} is not a member of this organization`);
  }

  const assignments: HomeAssignment[] = [];
  const approvedAmounts: Money[] = [];
  const paidAmounts: Money[] = [];
  const projectedAmounts: Money[] = [];

  for (const opportunity of dataset.opportunities) {
    const mine = dataset.assignments.filter(
      (assignment) =>
        assignment.opportunityId === opportunity.id && assignment.memberId === member.id,
    );
    if (mine.length === 0) continue;

    const built = buildOpportunityRail(dataset, opportunity);

    for (const assignment of mine) {
      let money: AssignmentMoney;

      if (built.rail.kind === 'settlement') {
        const line = built.rail.segments
          .find((segment) => segment.key === assignment.roleKey)
          ?.participants.find((participant) => participant.memberId === member.id);
        if (line === undefined) {
          throw new DataError(
            `Member ${member.id} is assigned to settled opportunity ${opportunity.id} but has no settlement line`,
          );
        }
        money = { kind: 'approved', amount: line.amount, payoutStatus: line.payoutStatus };
        approvedAmounts.push(line.amount);
        const settlementLine = dataset.settlementLines.find((entry) => entry.id === line.lineId);
        if (settlementLine === undefined) {
          throw new DataError(`Rail participant ${line.lineId} has no settlement line`);
        }
        paidAmounts.push(payoutAllocatedFor(dataset, settlementLine));
      } else {
        const participant = built.rail.segments
          .flatMap((segment) => segment.participants)
          .find((entry) => entry.key === assignment.id);
        const amount = participant?.amount ?? zeroMoney();
        money = { kind: 'projected', amount };
        projectedAmounts.push(amount);
      }

      assignments.push({
        opportunityId: opportunity.id,
        code: built.summary.code,
        beneficiaryName: built.summary.beneficiaryName,
        beneficiaryLocation: built.summary.beneficiaryLocation,
        projectName: built.summary.projectName,
        serviceName: built.summary.serviceName,
        roleLabel: assignment.roleLabel,
        status: opportunity.status,
        active: ACTIVE_STATUSES.includes(opportunity.status),
        money,
      });
    }
  }

  const approved = sumMoney(approvedAmounts);
  const paid = sumMoney(paidAmounts);

  const nextActions: NextAction[] = [];
  for (const assignment of assignments) {
    if (!assignment.active) continue;
    nextActions.push({
      key: `evidence:${assignment.opportunityId}`,
      label: copy.home.actionEvidence,
      detail: `${assignment.code} · ${assignment.beneficiaryName}`,
      tone: 'neutral',
    });
  }
  if (isFounder(viewer)) {
    const pending = dataset.settlements.filter((settlement) => settlement.status === 'pending');
    for (const settlement of pending) {
      const opportunity = dataset.opportunities.find(
        (entry) => entry.id === settlement.opportunityId,
      );
      nextActions.push({
        key: `settle:${settlement.id}`,
        label: copy.home.actionSettle,
        detail:
          `${opportunity?.code ?? settlement.id} · ${opportunity?.beneficiaryName ?? ''}`.trim(),
        tone: 'attention',
      });
    }
  }

  return {
    member: {
      id: member.id,
      displayName: member.displayName,
      initials: member.initials,
      role: member.role,
    },
    money: {
      approved,
      paid,
      approvedUnpaid: subMoney(approved, paid),
      projected: sumMoney(projectedAmounts),
    },
    activeWorkCount: assignments.filter((assignment) => assignment.active).length,
    assignments,
    nextActions,
  };
}

export const syntheticHomeRepository: HomeRepository = {
  async getPersonalHome(viewer: ViewerContext): Promise<PersonalHome> {
    return buildPersonalHome(loadSyntheticDataset(), viewer);
  },
};
