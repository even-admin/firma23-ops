import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ isSupabaseConfigured: () => true }));
vi.mock('@/data/repositories/synthetic/home', () => {
  throw new Error('synthetic home must not load in configured mode');
});
vi.mock('@/data/repositories/synthetic/leaderboard', () => {
  throw new Error('synthetic leaderboard must not load in configured mode');
});

describe('configured data-authority selectors', () => {
  it('does not evaluate synthetic performance or provenance adapters', async () => {
    const [{ getActiveHomeRepository }, { getActiveLeaderboardRepository }] = await Promise.all([
      import('@/data/repositories/active/home'),
      import('@/data/repositories/active/leaderboard'),
    ]);

    await expect(getActiveHomeRepository()).resolves.toBeDefined();
    await expect(getActiveLeaderboardRepository()).resolves.toBeDefined();
  });
});
