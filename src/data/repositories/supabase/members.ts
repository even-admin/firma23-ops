import type { MemberDirectoryQuery, MemberRepository } from '@/data/repositories/members';
import {
  loadOperationalSnapshot,
  memberCards,
  personalHome,
} from '@/data/repositories/supabase/operational-reads';
import type { ViewerContext } from '@/lib/viewer';
import type { AssignmentPickerMember, OperatorProfile } from '@/types/views';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function listAssignmentMembers(viewer: ViewerContext): Promise<AssignmentPickerMember[]> {
  const client = await createSupabaseServerClient();
  if (client === null) throw new Error('Supabase is not configured.');

  // The setup RPC accepts only active same-org memberships. Query the same
  // authority boundary first so the picker cannot offer an invited or revoked
  // person and defer the rejection until submit.
  const { data: memberships, error: membershipsError } = await client
    .from('memberships')
    .select('member_id')
    .eq('org_id', viewer.orgId)
    .eq('status', 'active');
  if (membershipsError !== null) throw new Error(membershipsError.message);

  const activeMemberIds = (memberships ?? []).map((row) => row.member_id);
  if (activeMemberIds.length === 0) return [];

  const { data: members, error: membersError } = await client
    .from('members')
    .select('id, display_name, role')
    .eq('org_id', viewer.orgId)
    .in('id', activeMemberIds);
  if (membersError !== null) throw new Error(membersError.message);

  return (members ?? [])
    .map((member) => ({
      memberId: member.id,
      displayName: member.display_name,
      role: member.role,
    }))
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
