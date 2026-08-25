import { Suspense } from 'react';

import { OperationalHeader } from '@/components/chrome/OperationalHeader';
import { AssignmentQueue } from '@/components/dashboard/AssignmentQueue';
import { NextActionQueue } from '@/components/dashboard/NextActionQueue';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { syntheticHomeRepository } from '@/data/repositories/synthetic/home';

/*
 * Loading UI lives in a Suspense boundary inside the page, not in a segment-level
 * loading.tsx. A loading.tsx anywhere above a dynamic route flushes the stream
 * immediately, which locks the response status at 200 and makes notFound() render
 * the not-found UI with a 200 instead of a 404. Streaming from inside the page
 * keeps the header instant, the body skeletoned, and the status honest.
 */

/** Personal home: what I have earned, what I am owed, what I can work on next. */
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <Suspense fallback={<LoadingBlock rows={4} />}>
        <HomeBody />
      </Suspense>
    </div>
  );
}

async function HomeBody() {
  const viewer = await getViewer();
  const home = await syntheticHomeRepository.getPersonalHome(viewer);

  return (
    <>
      <OperationalHeader
        displayName={home.member.displayName}
        initials={home.member.initials}
        money={home.money}
        activeWorkCount={home.activeWorkCount}
        activeAssignmentCodes={home.assignments
          .filter((assignment) => assignment.active)
          .map((assignment) => assignment.code)}
        primaryActionLabel={copy.home.primaryAction}
        primaryActionEnabled={false}
        primaryActionDescription={copy.home.primaryActionUnavailable}
      />

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.home.nextActions}</h2>
        <NextActionQueue actions={home.nextActions} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.home.assignments}</h2>
        <AssignmentQueue assignments={home.assignments} />
      </section>
    </>
  );
}
