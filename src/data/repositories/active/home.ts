import { isSupabaseConfigured } from '@/lib/backend';
import type { HomeRepository } from '@/data/repositories/home';
import { supabaseHomeRepository } from '@/data/repositories/supabase/home';
import { syntheticHomeRepository } from '@/data/repositories/synthetic/home';

export const activeHomeRepository: HomeRepository = isSupabaseConfigured()
  ? supabaseHomeRepository
  : syntheticHomeRepository;
