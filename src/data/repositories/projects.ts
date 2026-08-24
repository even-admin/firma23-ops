import type { ViewerContext } from '@/lib/viewer';
import type { ProjectDetail, ProjectSummary } from '@/types/views';

export interface ProjectRepository {
  list(viewer: ViewerContext): Promise<ProjectSummary[]>;
  getBySlug(slug: string, viewer: ViewerContext): Promise<ProjectDetail | null>;
}
