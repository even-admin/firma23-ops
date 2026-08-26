import { isSupabaseConfigured } from '@/lib/backend';
import type { FinanceRepository } from '@/data/repositories/finance';
import { supabaseOperationalFinanceRepository } from '@/data/repositories/supabase/operational-finance';
import { syntheticFinanceRepository } from '@/data/repositories/synthetic/finance';

export const activeOperationalFinanceRepository: FinanceRepository = isSupabaseConfigured()
  ? supabaseOperationalFinanceRepository
  : syntheticFinanceRepository;
