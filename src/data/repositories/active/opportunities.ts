import { isSupabaseConfigured } from '@/lib/backend';
import type { OpportunityRepository } from '@/data/repositories/opportunities';
import { supabaseOpportunityRepository } from '@/data/repositories/supabase/opportunities';
import { syntheticOpportunityRepository } from '@/data/repositories/synthetic/opportunities';

export const activeOpportunityRepository: OpportunityRepository = isSupabaseConfigured()
  ? supabaseOpportunityRepository
  : syntheticOpportunityRepository;
