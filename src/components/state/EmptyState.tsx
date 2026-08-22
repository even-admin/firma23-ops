import { cn } from '@/lib/cn';

interface EmptyStateProps {
  readonly title: string;
  readonly detail?: string;
  readonly className?: string;
}

export function EmptyState({ title, detail, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-line bg-surface flex min-h-36 flex-col items-start justify-end gap-1 rounded-md border border-dashed p-6',
        className,
      )}
    >
      <span aria-hidden="true" className="bg-line-strong mb-auto block h-px w-8" />
      <p className="text-ink-strong text-base font-medium">{title}</p>
      {detail === undefined ? null : <p className="text-faint text-sm">{detail}</p>}
    </div>
  );
}
