/**
 * The one place the document-intake feature picks between the synthetic and
 * Supabase repository implementations. Every route imports this instead of
 * either concrete adapter directly, so flipping NEXT_PUBLIC_SUPABASE_URL on
 * is the entire M1 -> M2 migration for this feature — no route or component
 * changes.
 *
 * Selected once at module load, matching how the rest of M1 resolves its
 * viewer/data source: a constant read at import time, not a per-request
 * check, since the environment does not change while the process runs.
 */

import { isSupabaseConfigured } from '@/lib/backend';
import type { IntakeRepository } from '@/data/repositories/intake';
import { syntheticIntakeRepository } from '@/data/repositories/synthetic/intake';
import { supabaseIntakeRepository } from '@/data/repositories/supabase/intake';

export const activeIntakeRepository: IntakeRepository = isSupabaseConfigured()
  ? supabaseIntakeRepository
  : syntheticIntakeRepository;
