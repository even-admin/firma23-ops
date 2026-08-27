import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backend', () => ({ isSupabaseConfigured: () => true }));
vi.mock('@/data/repositories/synthetic/home', () => {
  throw new Error('synthetic home must not load in configured mode');
});
vi.mock('@/data/repositories/synthetic/leaderboard', () => {
  throw new Error('synthetic leaderboard must not load in configured mode');
});
vi.mock('@/data/repositories/synthetic/projects', () => {
  throw new Error('synthetic projects must not load in configured mode');
});
vi.mock('@/data/repositories/synthetic/finance', () => {
  throw new Error('synthetic finance must not load in configured mode');
});

describe('configured data-authority selectors', () => {
  it('does not evaluate synthetic performance, provenance, or shared-layout adapters', async () => {
    const [
      { getActiveHomeRepository },
      { getActiveLeaderboardRepository },
      { getActiveProjectRepository },
      { getActiveOperationalFinanceRepository },
    ] = await Promise.all([
      import('@/data/repositories/active/home'),
      import('@/data/repositories/active/leaderboard'),
      import('@/data/repositories/active/projects'),
      import('@/data/repositories/active/operational-finance'),
    ]);

    await expect(getActiveHomeRepository()).resolves.toBeDefined();
    await expect(getActiveLeaderboardRepository()).resolves.toBeDefined();
    await expect(getActiveProjectRepository()).resolves.toBeDefined();
    await expect(getActiveOperationalFinanceRepository()).resolves.toBeDefined();
  });
});
