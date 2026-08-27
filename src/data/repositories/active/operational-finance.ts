import { isSupabaseConfigured } from '@/lib/backend';
import type { FinanceRepository } from '@/data/repositories/finance';
import { supabaseOperationalFinanceRepository } from '@/data/repositories/supabase/operational-finance';

export async function getActiveOperationalFinanceRepository(): Promise<FinanceRepository> {
  if (isSupabaseConfigured()) return supabaseOperationalFinanceRepository;
  const { syntheticFinanceRepository } = await import('@/data/repositories/synthetic/finance');
  return syntheticFinanceRepository;
}
