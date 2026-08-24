/**
 * The one place the settlement write boundary picks between the synthetic
 * and Supabase repository implementations, mirroring active/intake.ts.
 *
 * Narrower than SettlementRepository on purpose: the Supabase adapter has
 * no read implementation yet (see data/repositories/supabase/settlements.ts),
 * so only the two canonical write doors are selectable here. Read methods
 * still resolve through the synthetic adapter directly until that work
 * exists — this file adds no UI or Server Action, only the selector.
 */

import { isSupabaseConfigured } from '@/lib/backend';
import type { SettlementRepository } from '@/data/repositories/settlements';
import { supabaseSettlementRepository } from '@/data/repositories/supabase/settlements';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';

export const activeSettlementWriteRepository: Pick<
  SettlementRepository,
  'approveSettlement' | 'reverseSettlement'
> = isSupabaseConfigured() ? supabaseSettlementRepository : syntheticSettlementRepository;
