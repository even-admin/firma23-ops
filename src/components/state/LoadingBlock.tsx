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
        <div key={index} className="border-line bg-surface h-16 rounded-md border" />
      ))}
      <span className="sr-only">{copy.states.loading}</span>
    </div>
  );
}
