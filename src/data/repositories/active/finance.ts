/**
 * The one place the finance write boundary picks between the synthetic and
 * Supabase repository implementations, mirroring active/intake.ts.
 *
 * Narrower than FinanceRepository on purpose: the Supabase adapter has no
 * read implementation yet (see data/repositories/supabase/finance.ts), so
 * only the two canonical write doors are selectable here. Read methods
 * still resolve through the synthetic adapter directly until that work
 * exists — this file adds no UI or Server Action, only the selector.
 */

import { isSupabaseConfigured } from '@/lib/backend';
import type { FinanceRepository } from '@/data/repositories/finance';
import { supabaseFinanceRepository } from '@/data/repositories/supabase/finance';
import { syntheticFinanceRepository } from '@/data/repositories/synthetic/finance';

export const activeFinanceWriteRepository: Pick<
  FinanceRepository,
  'recordCashEvent' | 'recordPayout'
> = isSupabaseConfigured() ? supabaseFinanceRepository : syntheticFinanceRepository;
