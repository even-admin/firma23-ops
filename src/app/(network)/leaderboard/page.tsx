import { Suspense } from 'react';

import { LeaderboardRankRow } from '@/components/leaderboard/LeaderboardRankRow';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { getActiveLeaderboardRepository } from '@/data/repositories/active/leaderboard';

async function LeaderboardBody() {
  const viewer = await getViewer();
  const rows = await (await getActiveLeaderboardRepository()).list(viewer);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-3xl font-medium sm:text-4xl">
          {copy.leaderboard.title}
        </h1>
        <p className="text-muted text-sm">{copy.leaderboard.subtitle}</p>
      </header>

      {rows.length === 0 ? (
        <EmptyState title={copy.states.empty} />
      ) : (
        <ul className="spatial-object border-line overflow-hidden border">
          {rows.map((row) => (
            <LeaderboardRankRow
              key={row.memberId}
              row={row}
              showProvenance={viewer.role === 'founder' || viewer.viewerId === row.memberId}
            />
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
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
      <LoadingBlock rows={4} />
    </div>
  );
}
