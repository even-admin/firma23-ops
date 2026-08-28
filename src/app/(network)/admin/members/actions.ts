'use server';

import { activeInviteRepository } from '@/data/repositories/active/invites';
import { getViewer } from '@/data/viewer-session';
import type { CreateMemberInviteInput, CreateMemberInviteResult } from '@/types/views';

export async function createMemberInviteAction(
  input: CreateMemberInviteInput,
): Promise<CreateMemberInviteResult> {
  return activeInviteRepository.create(input, await getViewer());
}
