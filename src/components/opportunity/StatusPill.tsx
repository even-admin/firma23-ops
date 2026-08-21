import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { OpportunityStatus } from '@/types/domain';

interface StatusPillProps {
  readonly status: OpportunityStatus;
  readonly className?: string;
}

/** Amber marks work needing attention; red marks a failed state. Nothing else is coloured. */
const TONES: Record<OpportunityStatus, string> = {
  draft: 'border-line text-faint',
  assigned: 'border-line-strong text-muted',
  in_delivery: 'border-line-strong text-muted',
  delivered: 'border-attention/50 text-attention',
  settled_approved: 'border-money/50 text-money',
  paid: 'border-money/50 text-money',
  cancelled: 'border-danger/40 text-danger',
};

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'label-micro inline-flex items-center rounded-sm border px-2 py-0.5 font-medium',
        TONES[status],
        className,
      )}
    >
      {copy.opportunity.statusLabels[status]}
    </span>
  );
}
