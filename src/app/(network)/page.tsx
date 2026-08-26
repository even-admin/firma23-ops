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
        money={home.money}
        progression={home.member.progression}
        activeWorkCount={home.activeWorkCount}
        activeAssignmentCodes={home.assignments
          .filter((assignment) => assignment.active)
          .map((assignment) => assignment.code)}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(22rem,1.18fr)]">
        <section className="border-line bg-surface min-w-0 rounded-lg border p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="label-micro text-faint">{copy.home.commandCenter}</p>
              <h2 className="text-ink-strong mt-1 text-xl font-medium">{copy.home.nextActions}</h2>
            </div>
            <span className="label-micro text-faint tnum">{home.nextActions.length}</span>
          </div>
          <NextActionQueue actions={home.nextActions} />
        </section>

        <section className="border-line bg-surface min-w-0 rounded-lg border p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="label-micro text-faint">{copy.home.workstream}</p>
              <h2 className="text-ink-strong mt-1 text-xl font-medium">{copy.home.assignments}</h2>
            </div>
            <span className="label-micro text-faint tnum">{home.assignments.length}</span>
          </div>
          <AssignmentQueue assignments={home.assignments} />
        </section>
      </div>
    </>
  );
}
