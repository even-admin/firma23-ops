import type { ViewerContext } from '@/lib/viewer';
import type { LeaderboardProvenance, LeaderboardRow } from '@/types/views';

export interface LeaderboardRepository {
  /** Ranked by approved earnings only. Projections are carried, never ranked. */
  list(viewer: ViewerContext): Promise<LeaderboardRow[]>;
  getProvenance(slug: string, viewer: ViewerContext): Promise<LeaderboardProvenance | null>;
}
