import { describe, expect, it, vi } from 'vitest';

const from = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({ from })),
}));

import { listAssignmentMembers } from '@/data/repositories/supabase/members';

const VIEWER = {
  viewerId: 'founder-id',
  orgId: 'org-id',
  role: 'founder' as const,
};

describe('listAssignmentMembers', () => {
  it('offers every active same-org member, including a founder, and excludes invited records', async () => {
    const memberships = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(),
    };
    memberships.eq
      .mockReturnValueOnce(memberships)
      .mockResolvedValueOnce({
        data: [{ member_id: 'founder-id' }, { member_id: 'active-member-id' }],
        error: null,
      });
    const members = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'active-member-id', display_name: 'Diego Martinez', role: 'member' },
          { id: 'founder-id', display_name: 'Luis Ramirez', role: 'founder' },
        ],
        error: null,
      }),
    };
    from.mockImplementationOnce(() => memberships).mockImplementationOnce(() => members);

    await expect(listAssignmentMembers(VIEWER)).resolves.toEqual([
      { memberId: 'active-member-id', displayName: 'Diego Martinez', role: 'member' },
      { memberId: 'founder-id', displayName: 'Luis Ramirez', role: 'founder' },
    ]);
    expect(members.in).toHaveBeenCalledWith('id', ['founder-id', 'active-member-id']);
  });
});
