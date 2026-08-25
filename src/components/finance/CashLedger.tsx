import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/date';
import type { CashEventView } from '@/types/views';

interface CashLedgerProps {
  readonly events: readonly CashEventView[];
}

/**
 * The cash event ledger.
 *
 * Every row states whether it counts toward the distributable base, because a
 * deposit and a beneficiary contribution look identical until you say so.
 */
export function CashLedger({ events }: CashLedgerProps) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map((event) => (
        <li
          key={event.id}
          className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3"
        >
          <span className="min-w-0 flex-1">
            <span className="text-ink block truncate text-sm">{event.label}</span>
            <span className="text-faint block text-xs">{formatDate(event.occurredAt)}</span>
          </span>
          <span
            className={cn(
              'label-micro rounded-sm border px-2 py-0.5',
              event.countsTowardBase
                ? 'border-money/50 text-money'
                : 'border-line-strong text-faint',
            )}
          >
            {event.countsTowardBase ? copy.detail.inBase : copy.detail.outOfBase}
          </span>
          <Amount
            value={event.amount}
            className={cn('text-sm', event.amount.amount < 0 ? 'text-muted' : 'text-ink')}
          />
        </li>
      ))}
    </ul>
  );
}
