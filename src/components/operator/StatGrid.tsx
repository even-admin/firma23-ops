import { copy } from '@/copy/es-MX';
import { formatBasisPoints } from '@/lib/money';
import type { MemberStats } from '@/types/views';

interface StatGridProps {
  readonly stats: MemberStats;
}

/** Derived from append-only events. No member can edit any of these. */
export function StatGrid({ stats }: StatGridProps) {
  const cells: readonly { readonly label: string; readonly value: string }[] = [
    { label: copy.network.closed, value: String(stats.closed) },
    { label: copy.network.delivered, value: String(stats.delivered) },
    {
      label: copy.network.onTime,
      value:
        stats.onTimeRateBp === null ? copy.network.noRate : formatBasisPoints(stats.onTimeRateBp),
    },
    {
      label: copy.network.acceptance,
      value:
        stats.acceptanceRateBp === null
          ? copy.network.noRate
          : formatBasisPoints(stats.acceptanceRateBp),
    },
  ];

  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3">
      {cells.map((cell) => (
        <div key={cell.label}>
          <dt className="label-micro text-faint">{cell.label}</dt>
          <dd className="text-ink tnum mt-0.5 text-base font-medium">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}
