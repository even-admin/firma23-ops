import { isSupabaseConfigured } from '@/lib/backend';
import type { CrewRepository } from '@/data/repositories/crew';
import { supabaseCrewRepository } from '@/data/repositories/supabase/crew';
import { syntheticCrewRepository } from '@/data/repositories/synthetic/crew';

export const activeCrewRepository: CrewRepository = isSupabaseConfigured()
  ? supabaseCrewRepository
  : syntheticCrewRepository;
