import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { Availability } from '@/types/domain';

interface AvailabilityBadgeProps {
  readonly availability: Availability;
}

const TONES: Record<Availability, string> = {
  open: 'border-line-strong text-ink',
  limited: 'border-attention/50 text-attention',
  unavailable: 'border-line text-faint',
};

export function AvailabilityBadge({ availability }: AvailabilityBadgeProps) {
  return (
    <span
      className={cn(
        'label-micro inline-flex items-center rounded-sm border px-2 py-0.5 font-medium',
        TONES[availability],
      )}
    >
      {copy.network.availability[availability]}
    </span>
  );
}
