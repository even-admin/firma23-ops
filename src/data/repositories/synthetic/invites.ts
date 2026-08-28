import { copy } from '@/copy/es-MX';
import type { InviteRepository } from '@/data/repositories/invites';
import { assertFounder } from '@/lib/viewer';

export const syntheticInviteRepository: InviteRepository = {
  async list(viewer) {
    assertFounder(viewer, 'listMemberInvites');
    return [];
  },
  async create(_input, viewer) {
    assertFounder(viewer, 'createMemberInvite');
    return { kind: 'unavailable', reason: copy.admin.members.backendUnavailable };
  },
};
