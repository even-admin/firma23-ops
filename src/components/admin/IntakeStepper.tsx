import { cn } from '@/lib/cn';

export type IntakeStepKey = 'document' | 'extraction' | 'review' | 'confirmation';
export type IntakeStepStatus = 'complete' | 'current' | 'upcoming';

interface IntakeStepperProps {
  readonly statuses: Readonly<Record<IntakeStepKey, IntakeStepStatus>>;
}

const STEP_ORDER: readonly IntakeStepKey[] = ['document', 'extraction', 'review', 'confirmation'];

/**
 * The four intake phase labels named in docs/UI-REFERENCE-CATALOG.md
 * ("Registration Stepper" adaptation): Documento, Extracción, Revisión,
 * Confirmación. `src/copy/es-MX.ts` is an Integrator-owned shared surface
 * UI-ADMIN may not edit directly (docs/UI-WORKSPACE-LAUNCH-PLAN.md ownership
 * matrix), so these live here pending centralization — tracked in
 * docs/ui-integration-requests/UI-ADMIN.md. Not a route-owned financial or
 * product rule, only display labels for a state machine already driven by
 * real phase/result data.
 */
const STEP_LABELS: Record<IntakeStepKey, string> = {
  document: 'Documento',
  extraction: 'Extracción',
  review: 'Revisión',
  confirmation: 'Confirmación',
};

const STEPPER_LABEL = 'Progreso de la propuesta';

/**
 * A truthful progress indicator over the document-first intake flow.
 * Status per step is derived entirely from real phase/result state by the
 * caller — this component never advances on its own and never animates a
 * step to "complete" without that state actually having occurred.
 */
export function IntakeStepper({ statuses }: IntakeStepperProps) {
  return (
    <ol aria-label={STEPPER_LABEL} className="flex flex-wrap items-center gap-2">
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
