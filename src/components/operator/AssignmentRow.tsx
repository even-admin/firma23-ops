import { Amount } from '@/components/money/Amount';
import { StatusPill } from '@/components/opportunity/StatusPill';
import { RailStateBadge } from '@/components/revenue-rail/RailStateBadge';
import type { HomeAssignment } from '@/types/views';

interface AssignmentRowProps {
  readonly assignment: HomeAssignment;
}

/**
 * One assignment on a member's home.
 *
 * The money badge is driven by the discriminated union, so a projected row cannot
 * present itself as approved even by mistake.
 */
export function AssignmentRow({ assignment }: AssignmentRowProps) {
  const projected = assignment.money.kind === 'projected';

  return (
    <li className="border-line bg-surface ease-firma hover:border-line-strong grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-md border p-4 transition-colors duration-150 sm:grid-cols-[1fr_auto_auto]">
      <div className="min-w-0 flex-1">
        <p className="text-ink truncate text-sm font-medium">{assignment.beneficiaryName}</p>
        <p className="text-faint truncate text-xs">
          {assignment.code} · {assignment.roleLabel} · {assignment.serviceName}
        </p>
      </div>

      <StatusPill status={assignment.status} className="justify-self-start sm:justify-self-auto" />

      <div className="row-span-2 flex flex-col items-end gap-1 sm:row-span-1">
        <Amount
          value={assignment.money.amount}
          className={projected ? 'text-muted text-sm' : 'text-ink text-sm'}
        />
        {assignment.money.kind === 'projected' ? (
          <RailStateBadge state="projected" />
        ) : (
          <RailStateBadge state={assignment.money.payoutStatus === 'paid' ? 'paid' : 'approved'} />
        )}
      </div>
    </li>
  );
}
