import { isSupabaseConfigured } from '@/lib/backend';
import type { LeaderboardRepository } from '@/data/repositories/leaderboard';
import { supabaseLeaderboardRepository } from '@/data/repositories/supabase/leaderboard';
import { syntheticLeaderboardRepository } from '@/data/repositories/synthetic/leaderboard';

export const activeLeaderboardRepository: LeaderboardRepository = isSupabaseConfigured()
  ? supabaseLeaderboardRepository
  : syntheticLeaderboardRepository;
