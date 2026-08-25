import { cn } from '@/lib/cn';
import { copy } from '@/copy/es-MX';

export type IntakeStepKey = 'document' | 'extraction' | 'review' | 'confirmation';
export type IntakeStepStatus = 'complete' | 'current' | 'upcoming';

interface IntakeStepperProps {
  readonly statuses: Readonly<Record<IntakeStepKey, IntakeStepStatus>>;
}

const STEP_ORDER: readonly IntakeStepKey[] = ['document', 'extraction', 'review', 'confirmation'];

const STEP_LABELS: Record<IntakeStepKey, string> = copy.admin.intake.stepper;

/**
 * A truthful progress indicator over the document-first intake flow.
 * Status per step is derived entirely from real phase/result state by the
 * caller — this component never advances on its own and never animates a
 * step to "complete" without that state actually having occurred.
 */
export function IntakeStepper({ statuses }: IntakeStepperProps) {
  return (
    <ol aria-label={copy.admin.intake.stepper.ariaLabel} className="flex flex-wrap items-center gap-2">
      {STEP_ORDER.map((key, index) => {
        const status = statuses[key];
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              aria-current={status === 'current' ? 'step' : undefined}
              className={cn(
                'label-micro flex min-h-8 items-center gap-1.5 rounded-sm border px-2 py-1 font-medium',
                status === 'complete' && 'border-line-strong text-muted',
                status === 'current' && 'border-ink-950 text-ink-strong',
                status === 'upcoming' && 'border-line text-faint',
              )}
            >
              <span aria-hidden="true" className="tnum">
                {index + 1}.
              </span>
              {STEP_LABELS[key]}
            </span>
            {index < STEP_ORDER.length - 1 ? (
              <span aria-hidden="true" className="text-faint">
                →
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
