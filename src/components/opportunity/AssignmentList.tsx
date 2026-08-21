import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import { BASIS_POINTS_TOTAL, formatBasisPoints } from '@/lib/money';
import type { AssignmentView } from '@/types/views';

interface AssignmentListProps {
  readonly assignments: readonly AssignmentView[];
  readonly deliveryWeightTotalBp: number;
}

/** Invariant 6: delivery weights must total 10,000 basis points before approval. */
export function AssignmentList({ assignments, deliveryWeightTotalBp }: AssignmentListProps) {
  const balanced = deliveryWeightTotalBp === BASIS_POINTS_TOTAL;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {assignments.map((assignment) => (
          <li
            key={assignment.id}
            className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3"
          >
            <span
              aria-hidden="true"
              className="border-line-strong text-muted label-micro flex size-7 items-center justify-center rounded-full border"
            >
              {assignment.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink block truncate text-sm">{assignment.displayName}</span>
              <span className="text-faint block truncate text-xs">{assignment.roleLabel}</span>
            </span>
            <span className="text-muted tnum text-sm">
              {formatBasisPoints(assignment.weightBp)}
            </span>
          </li>
        ))}
      </ul>

      <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="label-micro text-faint">{copy.detail.weights}</span>
        <span className={cn('tnum', balanced ? 'text-money' : 'text-attention')}>
          {formatBasisPoints(deliveryWeightTotalBp)}
        </span>
        <span className={balanced ? 'text-faint' : 'text-attention'}>
          {balanced ? copy.detail.weightsBalanced : copy.detail.weightsUnbalanced}
        </span>
      </p>
    </div>
  );
}
