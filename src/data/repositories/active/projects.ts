import { isSupabaseConfigured } from '@/lib/backend';
import type { ProjectRepository } from '@/data/repositories/projects';
import { supabaseProjectRepository } from '@/data/repositories/supabase/projects';
import { syntheticProjectRepository } from '@/data/repositories/synthetic/projects';

export const activeProjectRepository: ProjectRepository = isSupabaseConfigured()
  ? supabaseProjectRepository
  : syntheticProjectRepository;
