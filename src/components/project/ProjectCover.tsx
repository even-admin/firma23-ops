import { cn } from '@/lib/cn';

interface ProjectCoverProps {
  readonly projectId: string;
  readonly size?: 'thumbnail' | 'card' | 'hero';
  readonly className?: string;
}

const VARIANTS = [
  'project-cover--0',
  'project-cover--1',
  'project-cover--2',
  'project-cover--3',
] as const;

const SIZES: Record<NonNullable<ProjectCoverProps['size']>, string> = {
  thumbnail: 'h-11 w-16 rounded-[10px]',
  card: 'h-32 w-full rounded-[var(--radius-object)]',
  hero: 'min-h-52 w-full rounded-[var(--radius-focus)]',
};

function projectCoverVariant(projectId: string): number {
  let hash = 0;
  for (const character of projectId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % VARIANTS.length;
}

/** Deterministic editorial artwork. Palette never communicates project state. */
export function ProjectCover({ projectId, size = 'card', className }: ProjectCoverProps) {
  const variant = projectCoverVariant(projectId);

  return (
    <span
      aria-hidden="true"
      data-project-cover
      data-cover-variant={variant}
      className={cn(
        'project-cover block shrink-0 overflow-hidden',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    />
  );
}
