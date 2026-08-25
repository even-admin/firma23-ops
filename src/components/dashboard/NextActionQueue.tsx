import { EmptyState } from '@/components/state/EmptyState';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { NextAction } from '@/types/views';

interface NextActionQueueProps {
  readonly actions: readonly NextAction[];
}

/**
 * Renders next actions as a ranked queue instead of dataset insertion order.
 *
 * Attention items (a founder's pending settlement, for example) are real, waiting
 * work, so they lead; neutral items follow. The rank badge mirrors the leaderboard's
 * own ordinal styling on purpose — the point is priority, not decoration.
 */
export function NextActionQueue({ actions }: NextActionQueueProps) {
  if (actions.length === 0) {
    return <EmptyState title={copy.home.noActions} />;
  }

  const ordered = [...actions].sort((a, b) => {
    if (a.tone === b.tone) return 0;
    return a.tone === 'attention' ? -1 : 1;
  });

  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((action, index) => (
        <li
          key={action.key}
          className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-4"
        >
          <span className="label-micro text-faint tnum w-6 shrink-0">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              action.tone === 'attention' ? 'bg-attention' : 'bg-steel-500',
            )}
          />
          <span className="text-ink text-sm font-medium">{action.label}</span>
          <span className="text-faint truncate text-xs">{action.detail}</span>
        </li>
      ))}
    </ul>
  );
}
