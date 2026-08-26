import { isSupabaseConfigured } from '@/lib/backend';
import type { HomeRepository } from '@/data/repositories/home';
import { supabaseHomeRepository } from '@/data/repositories/supabase/home';

export async function getActiveHomeRepository(): Promise<HomeRepository> {
  if (isSupabaseConfigured()) return supabaseHomeRepository;
  const { syntheticHomeRepository } = await import('@/data/repositories/synthetic/home');
  return syntheticHomeRepository;
}
