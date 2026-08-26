import { copy } from '@/copy/es-MX';
import { IdentityOrb } from '@/components/operator/IdentityOrb';
import { cn } from '@/lib/cn';
import { formatBasisPoints } from '@/lib/money';
import type { AssignmentView, PoolWeightView } from '@/types/views';

interface AssignmentListProps {
  readonly assignments: readonly AssignmentView[];
  readonly pools: readonly PoolWeightView[];
}

/**
 * Invariant 6: each member_pool's weights must total 10,000 basis points
 * before approval — independently. A rule can define more than one pool
 * (SETY has closer and delivery); one section per pool, one balance check
 * per pool, never a single figure aggregated across all of them.
 */
export function AssignmentList({ assignments, pools }: AssignmentListProps) {
  return (
    <div className="flex flex-col gap-5">
      {pools.map((pool) => {
        const poolAssignments = assignments.filter((assignment) => assignment.roleKey === pool.key);
        return (
          <div key={pool.key} className="flex flex-col gap-3">
            <p className="label-micro text-faint">{pool.label}</p>
            <ul className="flex flex-col gap-2">
              {poolAssignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="identity-orb-surface border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3"
                >
                  <IdentityOrb memberId={assignment.memberId} size="compact" />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate text-sm">
                      {assignment.displayName}
                    </span>
                    <span className="text-faint block truncate text-xs">
                      {assignment.roleLabel}
                    </span>
                  </span>
                  <span className="text-muted tnum text-sm">
                    {formatBasisPoints(assignment.weightBp)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span className="label-micro text-faint">{copy.detail.weights}</span>
              <span className={cn('tnum', pool.balanced ? 'text-money' : 'text-attention')}>
                {formatBasisPoints(pool.totalBp)}
              </span>
              <span className={pool.balanced ? 'text-faint' : 'text-attention'}>
                {pool.balanced ? copy.detail.weightsBalanced : copy.detail.weightsUnbalanced}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
