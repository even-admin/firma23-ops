/**
 * Supabase-backed project repository.
 *
 * Second adapter after intake, written to prove the pattern established
 * there generalizes: RLS-respecting queries through the server client,
 * mapped into the exact same view models the synthetic adapter produces.
 * Not wired into any route yet — see the session handoff for why the
 * remaining read repositories (opportunities, members, leaderboard, finance,
 * settlements) are deferred rather than rushed out unverified.
 */

import type { ProjectRepository } from '@/data/repositories/projects';
import {
  listProjectSummaries,
  loadOperationalSnapshot,
  projectDetail,
} from '@/data/repositories/supabase/operational-reads';

export const supabaseProjectRepository: ProjectRepository = {
  async list(viewer) {
    return listProjectSummaries(await loadOperationalSnapshot(viewer));
  },

  async getBySlug(slug, viewer) {
    return projectDetail(await loadOperationalSnapshot(viewer), slug);
  },
};
