import { cn } from '@/lib/cn';
import { copy } from '@/copy/es-MX';

interface LoadingBlockProps {
  readonly rows?: number;
  readonly className?: string;
}

/** Skeleton rows. Quiet surface shift, no shimmer animation. */
export function LoadingBlock({ rows = 3, className }: LoadingBlockProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={copy.states.loading}
      className={cn('flex flex-col gap-2', className)}
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="border-line bg-surface flex h-16 animate-pulse flex-col justify-center gap-2 rounded-md border px-4"
        >
          <span className="bg-line-strong block h-2 w-1/4 rounded-sm" />
          <span className="bg-line block h-2 w-3/5 rounded-sm" />
        </div>
      ))}
      <span className="sr-only">{copy.states.loading}</span>
    </div>
  );
}
