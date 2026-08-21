import { Suspense } from 'react';

import { OperatorCard } from '@/components/operator/OperatorCard';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticMemberRepository } from '@/data/repositories/synthetic/members';

async function NetworkBody({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly availability?: string; readonly skill?: string }>;
}) {
  const { availability, skill } = await searchParams;
  const viewer = await getPrototypeViewer();
  const operators = await syntheticMemberRepository.listDirectory(
    { availability, skillId: skill },
    viewer,
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight sm:text-3xl">
          {copy.network.title}
        </h1>
        <p className="text-muted text-sm">{copy.network.subtitle}</p>
      </header>

      {operators.length === 0 ? (
        <EmptyState title={copy.network.noMembers} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {operators.map((operator) => (
            <li key={operator.memberId}>
              <OperatorCard operator={operator} />
            </li>
          ))}
        </ul>
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
export default function NetworkPage(props: Parameters<typeof NetworkBody>[0]) {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <NetworkBody {...props} />
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
