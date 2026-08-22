import { cn } from '@/lib/cn';
import { copy } from '@/copy/es-MX';
import type { ExtractionConfidence } from '@/types/views';

interface ConfidenceBadgeProps {
  readonly confidence: ExtractionConfidence;
  readonly className?: string;
}

/**
 * How sure the AI adapter is about one extracted value.
 *
 * Never ledger green: confidence is a statement about the AI's read, not about
 * money being earned, approved, or paid.
 */
const CONFIDENCE_STYLES: Record<ExtractionConfidence, string> = {
  high: 'border-line-strong text-muted',
  medium: 'border-attention/50 text-attention',
  low: 'border-attention text-attention',
};

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  return (
    <span
      className={cn(
        'label-micro inline-flex items-center rounded-sm border px-2 py-0.5 font-medium',
        CONFIDENCE_STYLES[confidence],
        className,
      )}
    >
      {copy.admin.intake.confidence[confidence]}
    </span>
  );
}
