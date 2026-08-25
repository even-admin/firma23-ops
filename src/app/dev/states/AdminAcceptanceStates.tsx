'use client';

import { ConfirmContractControl } from '@/components/admin/ConfirmContractControl';
import { DocumentIntakePanel } from '@/components/admin/DocumentIntakePanel';
import type {
  ConfirmContractDraftResult,
  DiscardContractDraftResult,
  IntakeRunView,
} from '@/types/views';

interface AdminAcceptanceStatesProps {
  readonly readyRun: IntakeRunView;
}

const BASE_PROPS = {
  draftId: '91000000-0000-4000-8000-000000000001',
  sponsorName: 'Secretaría de Economía y Trabajo de Yucatán',
  programName: 'SETY 2026',
  currency: 'MXN' as const,
  matchedProjectSlug: 'sety-2026',
  readyToConfirm: true,
};

const confirmOutcomes: readonly {
  readonly key: string;
  readonly action: () => Promise<ConfirmContractDraftResult>;
}[] = [
  {
    key: 'confirm-success',
    action: async () => ({ kind: 'confirmed', projectId: 'project-1', projectSlug: 'sety-2026' }),
  },
  {
    key: 'confirm-unavailable',
    action: async () => ({ kind: 'unavailable', reason: 'Confirmación no disponible.' }),
  },
  {
    key: 'confirm-error',
    action: async () => ({ kind: 'error', message: 'Error de confirmación.' }),
  },
  {
    key: 'confirm-rejected',
    action: async () => {
      throw new Error('Rejected confirmation');
    },
  },
];

const discardOutcomes: readonly {
  readonly key: string;
  readonly action: () => Promise<DiscardContractDraftResult>;
}[] = [
  { key: 'discard-success', action: async () => ({ kind: 'discarded' }) },
  {
    key: 'discard-unavailable',
    action: async () => ({ kind: 'unavailable', reason: 'Descarte no disponible.' }),
  },
  { key: 'discard-error', action: async () => ({ kind: 'error', message: 'Error de descarte.' }) },
  {
    key: 'discard-rejected',
    action: async () => {
      throw new Error('Rejected discard');
    },
  },
];

/** Development-only deterministic branches consumed by the exact-SHA browser gate. */
export function AdminAcceptanceStates({ readyRun }: AdminAcceptanceStatesProps) {
  const errorRun: IntakeRunView = {
    ...readyRun,
    id: 'acceptance-error-run',
    status: 'error',
    draft: null,
    errorMessage: 'Error controlado de extracción.',
  };

  return (
    <div className="flex flex-col gap-8" data-admin-acceptance-states>
      <section className="flex flex-col gap-3" data-admin-scenario="intake-ready">
        <h3 className="text-ink text-sm font-medium">Intake listo</h3>
        <DocumentIntakePanel
          runIntake={async () => {
            await new Promise((resolve) => setTimeout(resolve, 250));
            return readyRun;
          }}
        />
      </section>

      <section className="flex flex-col gap-3" data-admin-scenario="intake-error">
        <h3 className="text-ink text-sm font-medium">Intake con error</h3>
        <DocumentIntakePanel runIntake={async () => errorRun} />
      </section>

      {confirmOutcomes.map((scenario) => (
        <section
          key={scenario.key}
          className="flex flex-col gap-3"
          data-admin-scenario={scenario.key}
        >
          <h3 className="text-ink text-sm font-medium">{scenario.key}</h3>
          <ConfirmContractControl
            {...BASE_PROPS}
            confirmAction={scenario.action}
            discardAction={async () => ({ kind: 'unavailable', reason: 'No usado.' })}
          />
        </section>
      ))}

      {discardOutcomes.map((scenario) => (
        <section
          key={scenario.key}
          className="flex flex-col gap-3"
          data-admin-scenario={scenario.key}
        >
          <h3 className="text-ink text-sm font-medium">{scenario.key}</h3>
          <ConfirmContractControl
            {...BASE_PROPS}
            confirmAction={async () => ({ kind: 'unavailable', reason: 'No usado.' })}
            discardAction={scenario.action}
          />
        </section>
      ))}
    </div>
  );
}
