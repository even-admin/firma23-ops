import type { ViewerContext } from '@/lib/viewer';
import type {
  CreateMemberInviteInput,
  CreateMemberInviteResult,
  MemberInviteView,
} from '@/types/views';

/** Founder-only identity invitation boundary. It creates a pending local
 * membership and audit record; delivery is deliberately separate. */
export interface InviteRepository {
  list(viewer: ViewerContext): Promise<readonly MemberInviteView[]>;
  create(
    input: CreateMemberInviteInput,
    viewer: ViewerContext,
  ): Promise<CreateMemberInviteResult>;
}
