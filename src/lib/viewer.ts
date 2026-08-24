/**
 * Viewer context.
 *
 * This is threaded through every repository call from the first slice so that M2
 * can replace it with the authenticated Supabase session without changing a
 * single call site.
 *
 * It is NOT authorization. M1 filters in TypeScript to prototype product shape.
 * Row Level Security in Postgres is the only authorization this product will have,
 * and it arrives in M2.
 */

export type ViewerRole = 'founder' | 'member';

export interface ViewerContext {
  readonly viewerId: string;
  readonly orgId: string;
  readonly role: ViewerRole;
}

export class PermissionError extends Error {
  override readonly name = 'PermissionError';
}

export function isFounder(viewer: ViewerContext): boolean {
  return viewer.role === 'founder';
}

export function assertFounder(viewer: ViewerContext, action: string): void {
  if (!isFounder(viewer)) {
    throw new PermissionError(`Founder access required: ${action}`);
  }
}
