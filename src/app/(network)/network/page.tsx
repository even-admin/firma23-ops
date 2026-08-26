import { Suspense } from 'react';

import { MemberCoverflow } from '@/components/operator/MemberCoverflow';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { activeMemberRepository } from '@/data/repositories/active/members';

async function NetworkBody() {
  const viewer = await getViewer();
  const operators = await activeMemberRepository.listDirectory({}, viewer);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-3xl font-medium sm:text-4xl">
          {copy.network.title}
        </h1>
        <p className="text-muted text-sm">{copy.network.subtitle}</p>
      </header>

      {operators.length === 0 ? (
        <EmptyState title={copy.network.noMembers} />
      ) : (
        <MemberCoverflow operators={operators} />
      )}
    </div>
  );
}

/*
 * Loading UI lives in a Suspense boundary inside the page, not a segment-level
 * loading.tsx. A loading.tsx anywhere above a dynamic route flushes the stream
 * immediately, which locks the response status at 200 and makes notFound() serve
 * the not-found UI with a 200 instead of a 404.
 */
export default function NetworkPage() {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <NetworkBody />
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
