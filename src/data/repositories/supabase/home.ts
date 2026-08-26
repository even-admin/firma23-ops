import type { HomeRepository } from '@/data/repositories/home';
import { loadOperationalSnapshot, personalHome } from '@/data/repositories/supabase/operational-reads';

export const supabaseHomeRepository: HomeRepository = {
  async getPersonalHome(viewer) {
    return personalHome(await loadOperationalSnapshot(viewer), viewer);
  },
};
