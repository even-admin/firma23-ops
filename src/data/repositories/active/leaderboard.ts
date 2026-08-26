import { isSupabaseConfigured } from '@/lib/backend';
import type { LeaderboardRepository } from '@/data/repositories/leaderboard';
import { supabaseLeaderboardRepository } from '@/data/repositories/supabase/leaderboard';

/**
 * Keep the synthetic adapter out of configured module evaluation entirely.
 * This must remain a dynamic import: fixture loading in configured mode is a
 * data-authority failure even when the runtime branch would not call it.
 */
export async function getActiveLeaderboardRepository(): Promise<LeaderboardRepository> {
  if (isSupabaseConfigured()) return supabaseLeaderboardRepository;
  const { syntheticLeaderboardRepository } = await import('@/data/repositories/synthetic/leaderboard');
  return syntheticLeaderboardRepository;
}
