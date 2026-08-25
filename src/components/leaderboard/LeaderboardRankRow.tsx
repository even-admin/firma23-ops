import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import { formatBasisPoints } from '@/lib/money';
import type { LeaderboardRow } from '@/types/views';

interface LeaderboardRankRowProps {
  readonly row: LeaderboardRow;
}

/**
 * One ranked operator. Rank and the ranked figure (approved earnings) sit in
 * the primary row; paid and projected sit below a rule as context that never
 * enters the order.
 */
export function LeaderboardRankRow({ row }: LeaderboardRankRowProps) {
  return (
    <li className="border-line bg-surface flex flex-col gap-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="label-micro text-faint tnum w-6 shrink-0">
          {String(row.rank).padStart(2, '0')}
        </span>
        <span
          aria-hidden="true"
          className="border-line-strong text-muted label-micro flex size-8 shrink-0 items-center justify-center rounded-full border"
        >
          {row.initials}
        </span>
        <span className="min-w-0 flex-1">
          <Link
            href={`/network/${row.slug}`}
            className="text-ink hover:text-ink-strong flex min-h-11 items-center truncate text-sm font-medium underline-offset-4 hover:underline"
          >
            {row.displayName}
          </Link>
          <span className="text-faint block text-xs">
            {copy.leaderboard.closed} {row.closed} · {copy.leaderboard.delivered} {row.delivered} ·{' '}
            {copy.leaderboard.onTime}{' '}
            {row.onTimeRateBp === null ? copy.network.noRate : formatBasisPoints(row.onTimeRateBp)}
          </span>
        </span>

        {/* The ranked figure. */}
        <span className="text-right">
          <span className="label-micro text-faint block">{copy.leaderboard.approved}</span>
          <Amount value={row.approvedEarnings} className="text-money text-base font-medium" />
        </span>
      </div>

      {/*
        Projected sits below the rule, muted, and is excluded from the order.
        It is context, never a score.
      */}
      <div className="border-line flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t pt-2">
        <span className="text-xs">
          <span className="label-micro text-faint">{copy.leaderboard.paid} </span>
          <Amount value={row.paidEarnings} className="text-ink" />
        </span>
        <span className="text-xs">
          <span className="label-micro text-faint">{copy.leaderboard.projected} </span>
          <Amount value={row.projectedEarnings} className="text-muted" />
        </span>
        <Link
          href={`/leaderboard/${row.slug}/provenance`}
          className="text-faint hover:text-ink ml-auto inline-flex min-h-11 items-center text-xs underline decoration-dotted underline-offset-4"
        >
          {copy.leaderboard.provenance}
        </Link>
      </div>
    </li>
  );
}
