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
        'border-line bg-surface/40 flex flex-col items-start gap-1 rounded-md border border-dashed p-6',
        className,
      )}
    >
      <p className="text-ink text-sm font-medium">{title}</p>
      {detail === undefined ? null : <p className="text-faint text-sm">{detail}</p>}
    </div>
  );
}
