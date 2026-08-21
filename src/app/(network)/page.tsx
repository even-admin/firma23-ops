import { OperationalHeader } from '@/components/chrome/OperationalHeader';
import { AssignmentRow } from '@/components/operator/AssignmentRow';
import { EmptyState } from '@/components/state/EmptyState';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticHomeRepository } from '@/data/repositories/synthetic/home';
import { cn } from '@/lib/cn';

/** Personal home: what I have earned, what I am owed, what I can work on next. */
export default async function HomePage() {
  const viewer = await getPrototypeViewer();
  const home = await syntheticHomeRepository.getPersonalHome(viewer);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <OperationalHeader
        displayName={home.member.displayName}
        initials={home.member.initials}
        money={home.money}
        activeWorkCount={home.activeWorkCount}
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
    </div>
  );
}
