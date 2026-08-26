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
    <ol className="relative flex flex-col before:absolute before:top-5 before:bottom-5 before:left-[1.1875rem] before:w-px before:bg-line">
      {ordered.map((action, index) => (
        <li
          key={action.key}
          className="group relative grid min-h-16 grid-cols-[2.375rem_minmax(0,1fr)] items-center gap-3 py-2"
        >
          <span className="border-line bg-surface text-faint tnum relative z-10 flex size-9 items-center justify-center rounded-full border font-mono text-[11px]">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="border-line bg-bg group-hover:border-line-strong min-w-0 rounded-[var(--radius-record)] border px-4 py-3 transition-colors duration-150">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  action.tone === 'attention' ? 'bg-attention' : 'bg-steel-500',
                )}
              />
              <span className="text-ink text-sm font-medium">{action.label}</span>
            </span>
            <span className="text-faint mt-1 block truncate text-xs">{action.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
