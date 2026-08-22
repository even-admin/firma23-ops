'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import {
  confirmContractDraftAction,
  discardContractDraftAction,
} from '@/app/(network)/admin/intake-actions';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { CurrencyCode } from '@/lib/money';
import type {
  ConfirmContractDraftInput,
  ConfirmContractDraftResult,
  DiscardContractDraftResult,
} from '@/types/views';

interface ConfirmContractControlProps {
  readonly draftId: string | null;
  readonly sponsorName: string;
  readonly programName: string;
  readonly currency: CurrencyCode;
  readonly matchedProjectSlug: string | null;
  /** Disables the control before its inputs are actually ready (e.g. the
   * manual form's required fields are still empty). */
  readonly readyToConfirm: boolean;
  /** Injectable for tests, which have no Next.js request scope for the real
   * Server Actions' cookies() call. Defaults to the real actions. */
  readonly confirmAction?: (input: ConfirmContractDraftInput) => Promise<ConfirmContractDraftResult>;
  readonly discardAction?: (draftId: string) => Promise<DiscardContractDraftResult>;
}

const i = copy.admin.intake;

/**
 * The founder confirmation boundary, made interactive.
 *
 * This calls the real confirmContractDraft Server Action, which calls the
 * real repository, which calls the real Supabase RPC once a backend is
 * configured. In this environment there is none, so every attempt resolves
 * to the 'unavailable' branch below — but the code path itself is genuine,
 * not a simulation, and a retry after a transient 'error' actually retries.
 */
export function ConfirmContractControl({
  draftId,
  sponsorName,
  programName,
  currency,
  matchedProjectSlug,
  readyToConfirm,
  confirmAction = confirmContractDraftAction,
  discardAction = discardContractDraftAction,
}: ConfirmContractControlProps) {
  const [result, setResult] = useState<ConfirmContractDraftResult | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm(): void {
    startTransition(async () => {
      const outcome = await confirmAction({ draftId, sponsorName, programName, currency });
      setResult(outcome);
    });
  }

  function discard(): void {
    if (draftId === null) return;
    startTransition(async () => {
      const outcome = await discardAction(draftId);
      if (outcome.kind === 'discarded') setDiscarded(true);
    });
  }

  if (discarded) {
    return (
      <section className="border-line bg-surface flex flex-col gap-2 rounded-md border p-4">
        <p className="text-ink text-sm">{i.discarded}</p>
      </section>
    );
  }

  if (result?.kind === 'confirmed') {
    return (
      <section className="border-money/40 bg-surface flex flex-col gap-2 rounded-md border p-4">
        <p className="text-money text-sm font-medium">{i.confirmed}</p>
        <Link
          href={`/projects/${result.projectSlug}`}
          className="text-ink-strong text-sm underline-offset-4 hover:underline"
        >
          {copy.projects.title} → {programName}
        </Link>
      </section>
    );
  }

  const blockedReason = result?.kind === 'unavailable' ? result.reason : null;
  const errorMessage = result?.kind === 'error' ? result.message : null;

  return (
    <section className="border-line bg-surface flex flex-col gap-3 rounded-md border p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={isPending || !readyToConfirm}
          aria-describedby="intake-confirm-status"
          className={cn(
            'ease-firma flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150 sm:w-auto',
            isPending || !readyToConfirm
              ? 'border-line text-faint cursor-not-allowed'
              : 'border-ink-950 bg-ink-950 text-paper-000 hover:bg-ink-900',
          )}
        >
          {matchedProjectSlug === null ? i.confirm : i.confirmMatched}
        </button>
        {draftId === null ? null : (
          <button
            type="button"
            onClick={discard}
            disabled={isPending}
            className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {i.discard}
          </button>
        )}
      </div>
      <p id="intake-confirm-status" className="text-muted text-xs">
        {errorMessage ?? blockedReason ?? i.confirmHint}
      </p>
      {errorMessage === null ? null : (
        <button
          type="button"
          onClick={confirm}
          className="text-attention hover:text-ink-strong ease-firma flex min-h-11 items-center text-xs underline decoration-dotted underline-offset-4 transition-colors duration-150 md:min-h-0"
        >
          {i.retry}
        </button>
      )}
    </section>
  );
}
