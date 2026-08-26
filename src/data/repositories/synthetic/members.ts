import type { ViewerContext } from '@/lib/viewer';
import type { MemberDirectoryQuery, MemberRepository } from '@/data/repositories/members';
import { loadSyntheticDataset, type SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOpportunityRail } from '@/data/repositories/synthetic/rails';
import {
  ACTIVE_STATUSES,
  activeWorkCount,
  approvedEarnings,
  paidEarnings,
  statsFor,
} from '@/data/repositories/synthetic/shared';
import { DataError } from '@/lib/result';
import type { Member } from '@/types/domain';
import type {
  HomeAssignment,
  OperatorCardView,
  OperatorProfile,
  PortfolioView,
  SkillView,
} from '@/types/views';

const LEVEL_ORDER: Record<SkillView['level'], number> = {
  lead: 0,
  strong: 1,
  working: 2,
  learning: 3,
};

function skillsFor(dataset: SyntheticDataset, memberId: string): SkillView[] {
  return dataset.memberSkills
    .filter((entry) => entry.memberId === memberId)
    .map((entry) => {
      const skill = dataset.skills.get(entry.skillId);
      if (skill === undefined) {
        throw new DataError(`Member skill ${entry.id} references an unknown skill`);
      }
      return {
        id: skill.id,
        name: skill.name,
        family: skill.family,
        level: entry.level,
        verification: entry.verification,
      };
    })
    .sort(
      (a, b) =>
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name, 'es-MX'),
    );
}

function toCard(dataset: SyntheticDataset, member: Member): OperatorCardView {
  const profile = dataset.memberProfiles.get(member.id);
  if (profile === undefined) {
    throw new DataError(`Member ${member.id} has no profile record`);
  }
  const stats = statsFor(dataset, member.id);
  return {
    memberId: member.id,
    slug: member.slug,
    displayName: member.displayName,
    initials: member.initials,
    role: member.role,
    bio: profile.bio,
    availability: profile.availability,
    nextCapability: profile.nextCapability,
    joinedAt: profile.joinedAt,
    skills: skillsFor(dataset, member.id),
    stats,
    // Approved only. A profile never advertises a projection as earnings.
    approvedEarnings: approvedEarnings(dataset, member.id),
    paidEarnings: paidEarnings(dataset, member.id),
    activeWorkCount: activeWorkCount(dataset, member.id),
  };
}

export function buildOperatorProfile(
  dataset: SyntheticDataset,
  slug: string,
): OperatorProfile | null {
  const member = [...dataset.members.values()].find((entry) => entry.slug === slug);
  if (member === undefined) return null;

  const portfolio: PortfolioView[] = dataset.portfolioItems
    .filter((item) => item.memberId === member.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .map((item) => ({
      id: item.id,
      title: item.title,
      roleLabel: item.roleLabel,
      url: item.url,
      kind: item.kind,
      verification: item.verification,
      completedAt: item.completedAt,
    }));

  const recentWork: HomeAssignment[] = [];
  for (const opportunity of dataset.opportunities) {
    const mine = dataset.assignments.filter(
      (assignment) =>
        assignment.opportunityId === opportunity.id && assignment.memberId === member.id,
    );
    if (mine.length === 0) continue;

    const built = buildOpportunityRail(dataset, opportunity);
    for (const assignment of mine) {
      // A member may fill multiple project-defined pools in one opportunity.
      // Settlement identity therefore requires both the role key and member id.
      if (built.rail.kind === 'settlement') {
        const line = built.rail.segments
          .find((segment) => segment.key === assignment.roleKey)
          ?.participants.find((participant) => participant.memberId === member.id);
        if (line === undefined) continue;
        recentWork.push({
          opportunityId: opportunity.id,
          code: built.summary.code,
          beneficiaryName: built.summary.beneficiaryName,
          beneficiaryLocation: built.summary.beneficiaryLocation,
          projectName: built.summary.projectName,
          serviceName: built.summary.serviceName,
          roleLabel: assignment.roleLabel,
          status: opportunity.status,
          active: ACTIVE_STATUSES.includes(opportunity.status),
          money: { kind: 'approved', amount: line.amount, payoutStatus: line.payoutStatus },
        });
      } else if (built.rail.kind === 'projection') {
        const participant = built.rail.segments
          .flatMap((segment) => segment.participants)
          .find((entry) => entry.key === assignment.id);
        if (participant === undefined) continue;
        recentWork.push({
          opportunityId: opportunity.id,
          code: built.summary.code,
          beneficiaryName: built.summary.beneficiaryName,
          beneficiaryLocation: built.summary.beneficiaryLocation,
          projectName: built.summary.projectName,
          serviceName: built.summary.serviceName,
          roleLabel: assignment.roleLabel,
          status: opportunity.status,
          active: ACTIVE_STATUSES.includes(opportunity.status),
          money: { kind: 'projected', amount: participant.amount },
        });
      } else {
        recentWork.push({
          opportunityId: opportunity.id,
          code: built.summary.code,
          beneficiaryName: built.summary.beneficiaryName,
          beneficiaryLocation: built.summary.beneficiaryLocation,
          projectName: built.summary.projectName,
          serviceName: built.summary.serviceName,
          roleLabel: assignment.roleLabel,
          status: opportunity.status,
          active: ACTIVE_STATUSES.includes(opportunity.status),
          money: { kind: 'correction_required' },
        });
      }
    }
  }

  return { ...toCard(dataset, member), portfolio, recentWork };
}

export const syntheticMemberRepository: MemberRepository = {
  async listDirectory(
    query: MemberDirectoryQuery,
    _viewer: ViewerContext,
  ): Promise<OperatorCardView[]> {
    const dataset = loadSyntheticDataset();
    let cards = [...dataset.members.values()].map((member) => toCard(dataset, member));

    if (query.skillId !== undefined) {
      cards = cards.filter((card) => card.skills.some((skill) => skill.id === query.skillId));
    }
    if (query.availability !== undefined) {
      cards = cards.filter((card) => card.availability === query.availability);
    }

    return cards.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es-MX'));
  },

  async getProfileBySlug(slug: string, _viewer: ViewerContext): Promise<OperatorProfile | null> {
    return buildOperatorProfile(loadSyntheticDataset(), slug);
  },
};
