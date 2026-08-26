import type { MemberDirectoryQuery, MemberRepository } from '@/data/repositories/members';
import {
  loadOperationalSnapshot,
  memberCards,
  personalHome,
} from '@/data/repositories/supabase/operational-reads';
import type { ViewerContext } from '@/lib/viewer';
import type { AssignmentPickerMember, OperatorProfile } from '@/types/views';

export async function listAssignmentMembers(viewer: ViewerContext): Promise<AssignmentPickerMember[]> {
  const snapshot = await loadOperationalSnapshot(viewer);
  return [...snapshot.members.values()]
    .filter((member) => member.role === 'member')
    .map((member) => ({ memberId: member.id, displayName: member.displayName, role: member.role }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es-MX'));
}

export const supabaseMemberRepository: MemberRepository & {
  listAssignmentMembers(viewer: ViewerContext): Promise<AssignmentPickerMember[]>;
} = {
  async listDirectory(query: MemberDirectoryQuery, viewer: ViewerContext) {
    let cards = memberCards(await loadOperationalSnapshot(viewer));
    if (query.skillId !== undefined) {
      cards = cards.filter((card) => card.skills.some((skill) => skill.id === query.skillId));
    }
    if (query.availability !== undefined) {
      cards = cards.filter((card) => card.availability === query.availability);
    }
    return cards.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es-MX'));
  },

  async getProfileBySlug(slug: string, viewer: ViewerContext): Promise<OperatorProfile | null> {
    const snapshot = await loadOperationalSnapshot(viewer);
    const card = memberCards(snapshot).find((entry) => entry.slug === slug);
    if (card === undefined) return null;
    const recentWork = personalHome(snapshot, { ...viewer, viewerId: card.memberId }).assignments;
    return {
      ...card,
      portfolio: snapshot.portfolioItems.filter((item) => item.memberId === card.memberId),
      recentWork,
    };
  },

  listAssignmentMembers,
};
