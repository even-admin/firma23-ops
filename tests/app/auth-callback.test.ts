/**
 * Tests for src/app/auth/callback/route.ts.
 *
 * Two verification paths are exercised: `?code=` (exchangeCodeForSession)
 * and `?token_hash=&type=` (verifyOtp) — see the route's own doc comment for
 * why both exist. createSupabaseServerClient is mocked; there is no live
 * project reachable from this environment.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseServerClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

const { GET } = await import('@/app/auth/callback/route');

interface FakeClientOptions {
  readonly exchangeCodeForSession?: { error: { message: string } | null };
  readonly verifyOtp?: { error: { message: string } | null };
  readonly redeemInvite?: { data: unknown; error: { message: string } | null };
}

function fakeClient(options: FakeClientOptions) {
  return {
    auth: {
      exchangeCodeForSession: vi
        .fn()
        .mockResolvedValue(options.exchangeCodeForSession ?? { error: null }),
      verifyOtp: vi.fn().mockResolvedValue(options.verifyOtp ?? { error: null }),
    },
    rpc: vi.fn().mockResolvedValue(options.redeemInvite ?? { data: [{ state: 'redeemed' }], error: null }),
  };
}

function locationOf(response: Response): string {
  const location = response.headers.get('location');
  if (location === null) throw new Error('response has no Location header');
  return location;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /auth/callback', () => {
  it('redirects to invalid-session when neither code nor token_hash+type is present', async () => {
    const response = await GET(new Request('http://localhost:3000/auth/callback'));
    expect(locationOf(response)).toBe('http://localhost:3000/login?state=invalid-session');
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it('redirects to invalid-session when token_hash is present but type is not a recognized EmailOtpType', async () => {
    const response = await GET(
      new Request('http://localhost:3000/auth/callback?token_hash=abc&type=bogus'),
    );
    expect(locationOf(response)).toBe('http://localhost:3000/login?state=invalid-session');
  });

  it('redirects to backend-unavailable when the server client cannot be built', async () => {
    createSupabaseServerClientMock.mockResolvedValue(null);
    const response = await GET(new Request('http://localhost:3000/auth/callback?code=abc'));
    expect(locationOf(response)).toBe('http://localhost:3000/login?state=backend-unavailable');
  });

  it('exchanges a code and redirects home on success', async () => {
    createSupabaseServerClientMock.mockResolvedValue(fakeClient({}));
    const response = await GET(new Request('http://localhost:3000/auth/callback?code=abc'));
    expect(locationOf(response)).toBe('http://localhost:3000/');
  });

  it('redirects to invalid-session when the code exchange fails', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ exchangeCodeForSession: { error: { message: 'invalid code' } } }),
    );
    const response = await GET(new Request('http://localhost:3000/auth/callback?code=bad'));
    expect(locationOf(response)).toBe('http://localhost:3000/login?state=invalid-session');
  });

  it('verifies a token_hash+type and redirects home on success', async () => {
    const client = fakeClient({});
    createSupabaseServerClientMock.mockResolvedValue(client);
    const response = await GET(
      new Request('http://localhost:3000/auth/callback?token_hash=abc123&type=email'),
    );
    expect(locationOf(response)).toBe('http://localhost:3000/');
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'email' });
    expect(client.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('redirects to invalid-session when verifyOtp fails', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ verifyOtp: { error: { message: 'expired token' } } }),
    );
    const response = await GET(
      new Request('http://localhost:3000/auth/callback?token_hash=abc&type=magiclink'),
    );
    expect(locationOf(response)).toBe('http://localhost:3000/login?state=invalid-session');
  });

  it('redirects to not-invited when redeem_invite reports unavailable', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ redeemInvite: { data: [{ state: 'unavailable' }], error: null } }),
    );
    const response = await GET(new Request('http://localhost:3000/auth/callback?code=abc'));
    expect(locationOf(response)).toBe('http://localhost:3000/login?state=not-invited');
  });

  it('redirects to invite-expired when redeem_invite reports expired', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ redeemInvite: { data: [{ state: 'expired' }], error: null } }),
    );
    const response = await GET(new Request('http://localhost:3000/auth/callback?code=abc'));
    expect(locationOf(response)).toBe('http://localhost:3000/login?state=invite-expired');
  });

  it('redirects to backend-unavailable when redeem_invite itself errors', async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      fakeClient({ redeemInvite: { data: null, error: { message: 'network error' } } }),
    );
    const response = await GET(new Request('http://localhost:3000/auth/callback?code=abc'));
    expect(locationOf(response)).toBe('http://localhost:3000/login?state=backend-unavailable');
  });
});
