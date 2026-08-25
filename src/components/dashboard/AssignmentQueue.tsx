import { AssignmentRow } from '@/components/operator/AssignmentRow';
import { EmptyState } from '@/components/state/EmptyState';
import { copy } from '@/copy/es-MX';
import type { HomeAssignment } from '@/types/views';

interface AssignmentQueueProps {
  readonly assignments: readonly HomeAssignment[];
}

/**
 * Active assignments surface before settled/paid history, so the list reads as
 * "what's live right now" first. `AssignmentRow` itself is shared, cross-lane
 * ownership — this only orders what is handed to it.
 */
export function AssignmentQueue({ assignments }: AssignmentQueueProps) {
  if (assignments.length === 0) {
    return <EmptyState title={copy.home.noAssignments} detail={copy.home.noAssignmentsDetail} />;
  }

  const ordered = [...assignments].sort((a, b) => {
    if (a.active === b.active) return 0;
    return a.active ? -1 : 1;
  });

  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((assignment) => (
        <AssignmentRow
          key={`${assignment.opportunityId}:${assignment.roleLabel}`}
          assignment={assignment}
        />
      ))}
    </ul>
  );
}
