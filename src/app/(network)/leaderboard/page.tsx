import { Suspense } from 'react';

import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticLeaderboardRepository } from '@/data/repositories/synthetic/leaderboard';
import { formatBasisPoints } from '@/lib/money';

async function LeaderboardBody() {
  const viewer = await getPrototypeViewer();
  const rows = await syntheticLeaderboardRepository.list(viewer);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight sm:text-3xl">
          {copy.leaderboard.title}
        </h1>
        <p className="text-muted text-sm">{copy.leaderboard.subtitle}</p>
      </header>

      {rows.length === 0 ? (
        <EmptyState title={copy.states.empty} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.memberId}
              className="border-line bg-surface flex flex-col gap-3 rounded-md border p-4"
            >
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
                    className="text-ink hover:text-ink-strong block truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {row.displayName}
                  </Link>
                  <span className="text-faint block text-xs">
                    {copy.leaderboard.closed} {row.closed} · {copy.leaderboard.delivered}{' '}
                    {row.delivered} · {copy.leaderboard.onTime}{' '}
                    {row.onTimeRateBp === null
                      ? copy.network.noRate
                      : formatBasisPoints(row.onTimeRateBp)}
                  </span>
                </span>

                {/* The ranked figure. */}
                <span className="text-right">
                  <span className="label-micro text-faint block">{copy.leaderboard.approved}</span>
                  <Amount
                    value={row.approvedEarnings}
                    className="text-money text-base font-medium"
                  />
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
                  className="text-faint hover:text-ink ml-auto text-xs underline decoration-dotted underline-offset-4"
                >
                  {copy.leaderboard.provenance}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-faint text-xs">{copy.leaderboard.projectedNote}</p>
    </div>
  );
}

/*
 * Loading UI lives in a Suspense boundary inside the page, not a segment-level
 * loading.tsx. A loading.tsx anywhere above a dynamic route flushes the stream
 * immediately, which locks the response status at 200 and makes notFound() serve
 * the not-found UI with a 200 instead of a 404.
 */
export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <LeaderboardBody />
    </Suspense>
  );
}

function LoadingWrap() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <LoadingBlock rows={4} />
    </div>
  );
}
