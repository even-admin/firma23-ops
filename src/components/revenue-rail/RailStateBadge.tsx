import { cn } from '@/lib/cn';
import { copy } from '@/copy/es-MX';

export type RailState = 'projected' | 'approved' | 'paid';

interface RailStateBadgeProps {
  readonly state: RailState;
  readonly className?: string;
}

const STATE_STYLES: Record<RailState, string> = {
  /* Projected money never borrows the ledger colour. */
  projected: 'border-dashed border-line-strong text-muted',
  approved: 'border-money/50 text-money',
  paid: 'border-money bg-money text-bg',
};

const STATE_LABELS: Record<RailState, string> = {
  projected: copy.money.projected,
  approved: copy.money.approved,
  paid: copy.money.paid,
};

export function RailStateBadge({ state, className }: RailStateBadgeProps) {
  return (
    <span
      className={cn(
        'label-micro inline-flex items-center rounded-sm border px-2 py-0.5 font-medium',
        STATE_STYLES[state],
        className,
      )}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
