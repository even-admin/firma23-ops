import { isSupabaseConfigured } from '@/lib/backend';
import type { SettlementRepository } from '@/data/repositories/settlements';
import { supabaseSettlementRepository } from '@/data/repositories/supabase/settlements';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';

export const activeSettlementRepository: SettlementRepository = isSupabaseConfigured()
  ? supabaseSettlementRepository
  : syntheticSettlementRepository;
