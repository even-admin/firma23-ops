import type { ViewerContext } from '@/lib/viewer';
import type { OperatorCardView, OperatorProfile } from '@/types/views';

export interface MemberDirectoryQuery {
  readonly skillId?: string | undefined;
  readonly availability?: string | undefined;
}

export interface MemberRepository {
  listDirectory(query: MemberDirectoryQuery, viewer: ViewerContext): Promise<OperatorCardView[]>;
  getProfileBySlug(slug: string, viewer: ViewerContext): Promise<OperatorProfile | null>;
}
