import { Suspense } from 'react';

import { AssignmentQueue } from '@/components/dashboard/AssignmentQueue';
import { NextActionQueue } from '@/components/dashboard/NextActionQueue';
import { PersonalCommandStrip } from '@/components/dashboard/PersonalCommandStrip';
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
      <PersonalCommandStrip
        displayName={home.member.displayName}
        activeWorkCount={home.activeWorkCount}
        money={home.money}
        performance={home.performance}
      />

      <div className="grid min-w-0 gap-x-10 gap-y-8 border-t border-line pt-7 xl:grid-cols-[minmax(0,0.82fr)_minmax(22rem,1.18fr)]">
        <section className="min-w-0">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-faint text-xs">{copy.home.commandCenter}</p>
              <h2 className="text-ink-strong mt-1 text-xl font-medium">{copy.home.nextActions}</h2>
            </div>
            <span className="text-faint tnum font-mono text-xs">{home.nextActions.length}</span>
          </div>
          <NextActionQueue actions={home.nextActions} />
        </section>

        <section className="min-w-0">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-faint text-xs">{copy.home.workstream}</p>
              <h2 className="text-ink-strong mt-1 text-xl font-medium">{copy.home.assignments}</h2>
            </div>
            <span className="text-faint tnum font-mono text-xs">{home.assignments.length}</span>
          </div>
          <AssignmentQueue assignments={home.assignments} />
        </section>
      </div>
    </>
  );
}
