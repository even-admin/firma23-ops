import { copy } from '@/copy/es-MX';
import type { InviteRepository } from '@/data/repositories/invites';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertFounder } from '@/lib/viewer';

export const supabaseInviteRepository: InviteRepository = {
  async list(viewer) {
    assertFounder(viewer, 'listMemberInvites');
    const client = await createSupabaseServerClient();
    if (client === null) return [];

    const { data, error } = await client
      .from('member_invites')
      .select('id, member_id, email, invited_at, expires_at, redeemed_at, members!inner(display_name, memberships!inner(status, org_id))')
      .eq('members.org_id', viewer.orgId)
      .order('invited_at', { ascending: false });
    if (error !== null) throw new Error(error.message);

    return (data ?? []).flatMap((row) => {
      const member = row.members as unknown as {
        display_name: string;
        memberships: readonly { status: 'invited' | 'active' | 'revoked'; org_id: string }[];
      } | null;
      const membership = member?.memberships.find((entry) => entry.org_id === viewer.orgId);
      if (member === null || member === undefined || membership === undefined) return [];
      return [{
        inviteId: row.id,
        memberId: row.member_id,
        displayName: member.display_name,
        email: row.email,
        membershipStatus: membership.status,
        invitedAt: row.invited_at,
        expiresAt: row.expires_at,
        redeemedAt: row.redeemed_at,
      }];
    });
  },

  async create(input, viewer) {
    assertFounder(viewer, 'createMemberInvite');
    const client = await createSupabaseServerClient();
    if (client === null) return { kind: 'unavailable', reason: copy.admin.members.backendUnavailable };
    const { data, error } = await client.rpc('create_member_invite', {
      p_org_id: viewer.orgId,
      p_display_name: input.displayName,
      p_email: input.email,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) return { kind: 'error', message: error.message };
    const row = (data as readonly { member_id: string; invite_id: string; replayed: boolean }[])[0];
    if (row === undefined) return { kind: 'error', message: 'create_member_invite returned no row.' };
    return { kind: 'created', memberId: row.member_id, inviteId: row.invite_id, replayed: row.replayed };
  },
};
