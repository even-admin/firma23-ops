import { Suspense } from 'react';

import { OperationalHeader } from '@/components/chrome/OperationalHeader';
import { AssignmentRow } from '@/components/operator/AssignmentRow';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticHomeRepository } from '@/data/repositories/synthetic/home';
import { cn } from '@/lib/cn';

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
  const viewer = await getPrototypeViewer();
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
        primaryActionEnabled={home.activeWorkCount > 0}
      />

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.home.nextActions}</h2>
        {home.nextActions.length === 0 ? (
          <EmptyState title={copy.home.noActions} />
        ) : (
          <ul className="flex flex-col gap-2">
            {home.nextActions.map((action) => (
              <li
                key={action.key}
                className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-4"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    action.tone === 'attention' ? 'bg-attention' : 'bg-steel-500',
                  )}
                />
                <span className="text-ink text-sm font-medium">{action.label}</span>
                <span className="text-faint truncate text-xs">{action.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.home.assignments}</h2>
        {home.assignments.length === 0 ? (
          <EmptyState title={copy.home.noAssignments} detail={copy.home.noAssignmentsDetail} />
        ) : (
          <ul className="flex flex-col gap-2">
            {home.assignments.map((assignment) => (
              <AssignmentRow
                key={`${assignment.opportunityId}:${assignment.roleLabel}`}
                assignment={assignment}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
