import { Amount } from '@/components/money/Amount';
import { IdentityOrb } from '@/components/operator/IdentityOrb';
import { RailStateBadge } from '@/components/revenue-rail/RailStateBadge';
import { copy } from '@/copy/es-MX';
import type {
  RailSegment as RailSegmentModel,
  SegmentParticipant,
  SettledLine,
} from '@/lib/allocation';
import { cn } from '@/lib/cn';
import { formatBasisPoints } from '@/lib/money';

interface RailSegmentProps {
  readonly segment: RailSegmentModel<SegmentParticipant> | RailSegmentModel<SettledLine>;
  readonly settled: boolean;
}

function isSettledLine(participant: SegmentParticipant | SettledLine): participant is SettledLine {
  return 'payoutStatus' in participant;
}

/**
 * One share of the base: house, closer, or a delivery pool.
 *
 * Width tracks the share weight so the rail reads as a proportion at a glance. A
 * projected segment is dashed and steel; a settled one is solid, and only a paid
 * line carries the ledger colour.
 */
export function RailSegment({ segment, settled }: RailSegmentProps) {
  const participants = segment.participants;

  return (
    <li
      className={cn(
        'border-line flex min-w-0 flex-col gap-2 border-b p-3 last:border-b-0 lg:min-h-36 lg:border-r lg:border-b-0 lg:p-4 lg:last:border-r-0',
        settled ? 'bg-surface' : 'bg-raised/45',
      )}
      style={{ flexGrow: segment.weightBp, flexBasis: 0 }}
      data-share-key={segment.key}
      data-money-state={settled ? 'approved' : 'projected'}
      aria-label={`${segment.label}, ${formatBasisPoints(segment.weightBp)} ${
        settled ? copy.money.approved : copy.money.projected
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-micro text-faint truncate">{segment.label}</span>
        <span className="label-micro text-faint tnum shrink-0">
          {formatBasisPoints(segment.weightBp)}
        </span>
      </div>

      <Amount
        value={segment.amount}
        className={cn(
          'text-xl font-medium tracking-[-0.025em]',
          settled ? 'text-ink-strong' : 'text-muted',
        )}
      />

      {participants.length === 0 ? (
        <p className="text-faint text-sm">{copy.money.unassigned}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {participants.map((participant) => {
            const paid = isSettledLine(participant) && participant.payoutStatus === 'paid';
            return (
              <li
                key={participant.key}
                className="identity-orb-surface flex min-w-0 items-center gap-2"
              >
                {participant.memberId === null ? (
                  <span
                    aria-hidden="true"
                    className="label-micro border-line-strong text-muted flex size-7 shrink-0 items-center justify-center rounded-full border font-medium"
                  >
                    {participant.initials}
                  </span>
                ) : (
                  <IdentityOrb memberId={participant.memberId} size="compact" className="size-7" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-sm">{participant.displayName}</span>
                  <span className="text-faint block truncate text-xs">{participant.roleLabel}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Amount
                    value={participant.amount}
                    className={cn('text-sm', settled ? 'text-ink' : 'text-muted')}
                  />
                  {isSettledLine(participant) ? (
                    <RailStateBadge state={paid ? 'paid' : 'approved'} />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
