'use client';

import { useId, useState } from 'react';

import { ConfirmContractControl } from '@/components/admin/ConfirmContractControl';
import { copy } from '@/copy/es-MX';

interface ManualContractFormProps {
  readonly onCancel: () => void;
}

const i = copy.admin.intake;

/**
 * The manual creation fallback.
 *
 * Deliberately the smaller path: no document, no AI extraction, no
 * confidence, no evidence, no service/milestone/allocation-rule suggestion —
 * a founder types only what a brand-new contract needs to exist as a draft
 * project, and picks its services and rules afterward. It shares the exact
 * same confirmContractDraft boundary the AI-drafted path uses (draftId is
 * null here, which the RPC treats as "create a new project"), so there is
 * only one authority boundary in the codebase, not two.
 */
export function ManualContractForm({ onCancel }: ManualContractFormProps) {
  const [sponsorName, setSponsorName] = useState('');
  const [programName, setProgramName] = useState('');
  const sponsorId = useId();
  const programId = useId();

  const readyToConfirm = sponsorName.trim().length > 0 && programName.trim().length > 0;

  return (
    <section className="border-line bg-surface flex flex-col gap-4 rounded-lg border p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-ink-strong text-lg font-medium">{i.manualTitle}</h2>
          <p className="text-faint text-sm">{i.manualSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 shrink-0 items-center rounded-md border px-3 text-xs transition-colors duration-150"
        >
          {i.manualCancel}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor={sponsorId} className="flex flex-col gap-1">
          <span className="label-micro text-faint">{i.manualSponsorLabel}</span>
          <input
            id={sponsorId}
            type="text"
            value={sponsorName}
            onChange={(event) => setSponsorName(event.target.value)}
            className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
          />
        </label>
        <label htmlFor={programId} className="flex flex-col gap-1">
          <span className="label-micro text-faint">{i.manualProgramLabel}</span>
          <input
            id={programId}
            type="text"
            value={programName}
            onChange={(event) => setProgramName(event.target.value)}
            className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
          />
        </label>
        {readyToConfirm ? null : <p className="text-faint text-xs">{i.manualRequired}</p>}
      </div>

      <ConfirmContractControl
        draftId={null}
        sponsorName={sponsorName.trim()}
        programName={programName.trim()}
        currency="MXN"
        matchedProjectSlug={null}
        readyToConfirm={readyToConfirm}
      />
    </section>
  );
}
