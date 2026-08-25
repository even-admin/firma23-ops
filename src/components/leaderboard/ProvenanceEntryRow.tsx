import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { RailStateBadge } from '@/components/revenue-rail/RailStateBadge';
import { copy } from '@/copy/es-MX';
import type { ProvenanceEntry } from '@/types/views';

interface ProvenanceEntryRowProps {
  readonly entry: ProvenanceEntry;
}

/**
 * One traced centavo: the settlement line behind part of a rank, with the
 * approving founder named so the total is auditable, not merely displayed.
 */
export function ProvenanceEntryRow({ entry }: ProvenanceEntryRowProps) {
  return (
    <li className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-4">
      <span className="min-w-0 flex-1">
        <Link
          href={`/opportunities/${entry.opportunityId}`}
          className="text-ink hover:text-ink-strong flex min-h-11 items-center truncate text-sm underline-offset-4 hover:underline md:min-h-0"
        >
          {entry.beneficiaryName}
        </Link>
        <span className="text-faint block truncate text-xs">
          {entry.opportunityCode} · {entry.projectName} · {entry.roleLabel}
        </span>
        <span className="text-faint block truncate text-xs">
          {copy.money.approvedBy} {entry.approvedByName} · {entry.approvedAt.slice(0, 10)}
        </span>
      </span>
      <Amount value={entry.amount} className="text-ink text-sm" />
      <RailStateBadge state={entry.payoutStatus === 'paid' ? 'paid' : 'approved'} />
    </li>
  );
}
