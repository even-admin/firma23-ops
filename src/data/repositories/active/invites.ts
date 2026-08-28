import { isSupabaseConfigured } from '@/lib/backend';
import type { InviteRepository } from '@/data/repositories/invites';
import { supabaseInviteRepository } from '@/data/repositories/supabase/invites';
import { syntheticInviteRepository } from '@/data/repositories/synthetic/invites';

export const activeInviteRepository: InviteRepository = isSupabaseConfigured()
  ? supabaseInviteRepository
  : syntheticInviteRepository;
