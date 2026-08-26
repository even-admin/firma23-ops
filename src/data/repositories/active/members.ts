import { isSupabaseConfigured } from '@/lib/backend';
import type { MemberRepository } from '@/data/repositories/members';
import { supabaseMemberRepository } from '@/data/repositories/supabase/members';
import { syntheticMemberRepository } from '@/data/repositories/synthetic/members';
import type { ViewerContext } from '@/lib/viewer';
import type { AssignmentPickerMember } from '@/types/views';

export const activeMemberRepository: MemberRepository & {
  listAssignmentMembers?(viewer: ViewerContext): Promise<AssignmentPickerMember[]>;
} = isSupabaseConfigured() ? supabaseMemberRepository : syntheticMemberRepository;
