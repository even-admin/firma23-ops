/**
 * Tests for src/data/viewer-session.ts's branching logic.
 *
 * All Supabase interaction is mocked — there is no live project reachable
 * from this environment (see scripts/db-verify.sh and the M2 Auth report for
 * the RPC/RLS behavior itself, verified against a disposable Postgres
 * instance and the real Supabase Development project instead). What is
 * testable here is that this file maps each combination of
 * getUser()/redeem_invite()/members-role response to the correct honest
 * ViewerSessionState, and delegates cleanly to the prototype viewer when
 * Supabase is not configured.
 *
 * resolveViewerSessionStateUncached (not getViewerSessionState) is what's
 * under test: the cached wrapper memoizes per React render/request scope,
 * which this test runner has no equivalent of, so calling the cached
 * version across cases would leak the first case's result into every case
 * after it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const isSupabaseConfiguredMock = vi.fn<() => boolean>();
const createSupabaseServerClientMock = vi.fn();
const getPrototypeViewerMock = vi.fn();

vi.mock('@/lib/backend', () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock,
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));
vi.mock('@/data/prototype-viewer-session', () => ({
  getPrototypeViewer: getPrototypeViewerMock,
}));

const { resolveViewerSessionStateUncached } = await import('@/data/viewer-session');
const { PROTOTYPE_FOUNDER } = await import('@/data/prototype-viewers');

interface FakeClientOptions {
  readonly getUser?: { data: { user: unknown }; error: { message: string } | null };
  readonly redeemInvite?: { data: unknown; error: { message: string } | null };
  readonly memberRole?: { data: unknown; error: { message: string } | null };
}

function fakeClient(options: FakeClientOptions) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        options.getUser ?? { data: { user: { id: 'auth-user-1' } }, error: null },
      ),
    },
    rpc: vi.fn().mockResolvedValue(options.redeemInvite ?? { data: [], error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(options.memberRole ?? { data: null, error: null }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveViewerSessionStateUncached — synthetic mode (Supabase not configured)', () => {
  it('delegates to the prototype viewer unchanged', async () => {
    isSupabaseConfiguredMock.mockReturnValue(false);
    getPrototypeViewerMock.mockResolvedValue(PROTOTYPE_FOUNDER);

    const state = await resolveViewerSessionStateUncached();

    expect(state).toEqual({ kind: 'viewer', viewer: PROTOTYPE_FOUNDER });
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });
});

describe('resolveViewerSessionStateUncached — Supabase configured', () => {
  beforeEach(() => {
    isSupabaseConfiguredMock.mockReturnValue(true);
  });

  it('reports backend-unavailable when the server client cannot be built', async () => {
    createSupabaseServerClientMock.mockResolvedValue(null);
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({
      kind: 'backend-unavailable',
    });
  });

  it('reports anonymous when there is no session at all', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ getUser: { data: { user: null }, error: { message: 'Auth session missing!' } } }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({ kind: 'anonymous' });
  });

  it('reports anonymous when getUser succeeds with a null user and no error', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ getUser: { data: { user: null }, error: null } }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({ kind: 'anonymous' });
  });

  it('reports invalid-session for a getUser error that is not a missing session', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ getUser: { data: { user: null }, error: { message: 'invalid JWT' } } }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({ kind: 'invalid-session' });
  });

  it('reports not-invited when redeem_invite returns unavailable', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ redeemInvite: { data: [{ state: 'unavailable', member_id: null, org_id: null }], error: null } }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({ kind: 'not-invited' });
  });

  it('reports invite-expired when redeem_invite returns expired', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ redeemInvite: { data: [{ state: 'expired', member_id: null, org_id: null }], error: null } }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({ kind: 'invite-expired' });
  });

  it('reports backend-unavailable when redeem_invite itself errors', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ redeemInvite: { data: null, error: { message: 'network error' } } }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({ kind: 'backend-unavailable' });
  });

  it('reports backend-unavailable when the member role lookup fails', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({
        redeemInvite: {
          data: [{ state: 'redeemed', member_id: 'member-1', org_id: 'org-1' }],
          error: null,
        },
        memberRole: { data: null, error: { message: 'not found' } },
      }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({ kind: 'backend-unavailable' });
  });

  it('resolves a real viewer for a redeemed invite', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({
        redeemInvite: {
          data: [{ state: 'redeemed', member_id: 'member-1', org_id: 'org-1' }],
          error: null,
        },
        memberRole: { data: { role: 'founder' }, error: null },
      }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({
      kind: 'viewer',
      viewer: { viewerId: 'member-1', orgId: 'org-1', role: 'founder' },
    });
  });

  it('resolves a real operator viewer for a first-time invited redemption', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({
        redeemInvite: {
          data: [{ state: 'invited', member_id: 'member-2', org_id: 'org-1' }],
          error: null,
        },
        memberRole: { data: { role: 'member' }, error: null },
      }),
    );
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({
      kind: 'viewer',
      viewer: { viewerId: 'member-2', orgId: 'org-1', role: 'member' },
    });
  });

  it('reports backend-unavailable when an unexpected exception is thrown', async () => {
    createSupabaseServerClientMock.mockRejectedValue(new Error('boom'));
    await expect(resolveViewerSessionStateUncached()).resolves.toEqual({
      kind: 'backend-unavailable',
    });
  });
});
