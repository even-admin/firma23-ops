import { IdentityOrb } from '@/components/operator/IdentityOrb';
import { copy } from '@/copy/es-MX';
import { formatDate } from '@/lib/date';
import { formatBasisPoints } from '@/lib/money';
import type { CrewChangeAssignmentView, CrewChangeReceiptView } from '@/types/views';

interface CrewChangeHistoryProps {
  readonly receipts: readonly CrewChangeReceiptView[];
  readonly poolLabels: ReadonlyMap<string, string>;
  readonly memberNames: ReadonlyMap<string, string>;
}

const c = copy.detail.crew;

function AssignmentSnapshot({
  assignments,
  memberNames,
}: {
  readonly assignments: readonly CrewChangeAssignmentView[];
  readonly memberNames: ReadonlyMap<string, string>;
}) {
  if (assignments.length === 0) return <p className="text-faint text-sm">—</p>;

  return (
    <ul className="flex flex-col gap-2">
      {assignments.map((assignment) => (
        <li key={`${assignment.memberId}-${assignment.roleLabel}`} className="flex items-center gap-3 text-sm">
          <IdentityOrb memberId={assignment.memberId} size="compact" />
          <span className="min-w-0 flex-1 truncate text-ink">
            {memberNames.get(assignment.memberId) ?? assignment.memberId}
          </span>
          <span className="text-faint truncate">{assignment.roleLabel}</span>
          <span className="tnum text-muted">{formatBasisPoints(assignment.weightBp)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Founder-visible, immutable before/after evidence from crew receipts. */
export function CrewChangeHistory({ receipts, poolLabels, memberNames }: CrewChangeHistoryProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="crew-history-title">
      <h2 id="crew-history-title" className="label-micro text-faint">
        {c.history}
      </h2>
      {receipts.length === 0 ? (
        <p className="text-faint text-sm">{c.historyEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {receipts.map((receipt) => (
            <details key={receipt.id} className="border-line bg-surface rounded-lg border p-4">
              <summary className="text-ink flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                <span>{poolLabels.get(receipt.roleKey) ?? receipt.roleKey}</span>
                <span className="text-faint font-normal">{formatDate(receipt.createdAt)}</span>
              </summary>
              <div className="grid gap-5 pt-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <p className="label-micro text-faint">{c.previousCrew}</p>
                  <AssignmentSnapshot assignments={receipt.beforeAssignments} memberNames={memberNames} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="label-micro text-faint">{c.replacementCrew}</p>
                  <AssignmentSnapshot assignments={receipt.afterAssignments} memberNames={memberNames} />
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
