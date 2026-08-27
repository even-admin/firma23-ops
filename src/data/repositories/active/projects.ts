import { isSupabaseConfigured } from '@/lib/backend';
import type { ProjectRepository } from '@/data/repositories/projects';
import { supabaseProjectRepository } from '@/data/repositories/supabase/projects';

export async function getActiveProjectRepository(): Promise<ProjectRepository> {
  if (isSupabaseConfigured()) return supabaseProjectRepository;
  const { syntheticProjectRepository } = await import('@/data/repositories/synthetic/projects');
  return syntheticProjectRepository;
}
