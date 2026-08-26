import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { IdentityOrb } from '@/components/operator/IdentityOrb';
import { copy } from '@/copy/es-MX';
import { formatBasisPoints } from '@/lib/money';
import type { LeaderboardRow } from '@/types/views';

interface LeaderboardRankRowProps {
  readonly row: LeaderboardRow;
  readonly showProvenance: boolean;
}

/**
 * One ranked operator. Rank and the ranked figure (approved earnings) sit in
 * the primary row; paid and projected sit below a rule as context that never
 * enters the order.
 */
export function LeaderboardRankRow({ row, showProvenance }: LeaderboardRankRowProps) {
  return (
    <li
      className="identity-orb-surface border-line bg-surface flex flex-col gap-3 border-b p-5 last:border-b-0 sm:p-6"
      data-leaderboard-member={row.slug}
    >
      <div className="grid min-w-0 grid-cols-[3rem_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[3rem_auto_minmax(0,1fr)_auto]">
        <span className="text-faint tnum row-span-2 font-mono text-3xl font-medium sm:row-span-1">
          {String(row.rank).padStart(2, '0')}
        </span>
        <IdentityOrb memberId={row.memberId} size="card" />
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
        <span className="col-start-3 text-left sm:col-start-4 sm:text-right" data-money-state="approved">
          <span className="label-micro text-faint block">{copy.leaderboard.approved}</span>
          <Amount value={row.approvedEarnings} className="text-money text-base font-medium" />
        </span>
      </div>

      {/*
        Projected sits below the rule, muted, and is excluded from the order.
        It is context, never a score.
      */}
      <div className="border-line flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t pt-2">
        {row.paidEarnings === undefined ? null : (
          <span className="text-xs" data-money-state="paid">
            <span className="label-micro text-faint">{copy.leaderboard.paid} </span>
            <Amount value={row.paidEarnings} className="text-ink" />
          </span>
        )}
        {row.projectedEarnings === undefined ? null : (
          <span className="text-xs" data-money-state="projected">
            <span className="label-micro text-faint">{copy.leaderboard.projected} </span>
            <Amount value={row.projectedEarnings} className="text-muted" />
          </span>
        )}
        {showProvenance ? (
          <Link
            href={`/leaderboard/${row.slug}/provenance`}
            className="text-faint hover:text-ink ml-auto inline-flex min-h-11 items-center text-xs underline decoration-dotted underline-offset-4"
          >
            {copy.leaderboard.provenance}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
