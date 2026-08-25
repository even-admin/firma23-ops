'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';

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
  readonly confirmAction?: (
    input: ConfirmContractDraftInput,
  ) => Promise<ConfirmContractDraftResult>;
  readonly discardAction?: (draftId: string) => Promise<DiscardContractDraftResult>;
  /** Notifies a parent (e.g. the intake stepper) once a real 'confirmed'
   * result comes back. Never called for 'unavailable' or 'error'. */
  readonly onConfirmed?: (() => void) | undefined;
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
  onConfirmed,
}: ConfirmContractControlProps) {
  const [result, setResult] = useState<ConfirmContractDraftResult | null>(null);
  const [discarded, setDiscarded] = useState(false);
  const [discardArmed, setDiscardArmed] = useState(false);
  const [discardResult, setDiscardResult] = useState<DiscardContractDraftResult | null>(null);
  const [pendingKind, setPendingKind] = useState<'confirm' | 'discard' | null>(null);
  const [isPending, startTransition] = useTransition();
  const outcomeRef = useRef<HTMLElement>(null);
  const pendingStatusRef = useRef<HTMLParagraphElement>(null);
  const discardTriggerRef = useRef<HTMLButtonElement>(null);
  const statusId = useId();

  useEffect(() => {
    if (discarded || result !== null || discardResult !== null) outcomeRef.current?.focus();
  }, [discarded, discardResult, result]);

  useEffect(() => {
    if (isPending && pendingKind !== null) {
      pendingStatusRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isPending, pendingKind]);

  function confirm(): void {
    setDiscardArmed(false);
    setDiscardResult(null);
    setResult(null);
    setPendingKind('confirm');
    startTransition(async () => {
      let outcome: ConfirmContractDraftResult;
      try {
        outcome = await confirmAction({ draftId, sponsorName, programName, currency });
      } catch {
        outcome = { kind: 'error', message: i.confirmRejected };
      }
      setResult(outcome);
      setPendingKind(null);
      if (outcome.kind === 'confirmed') onConfirmed?.();
    });
  }

  function executeDiscard(): void {
    if (draftId === null) return;
    setDiscardResult(null);
    setPendingKind('discard');
    startTransition(async () => {
      let outcome: DiscardContractDraftResult;
      try {
        outcome = await discardAction(draftId);
      } catch {
        outcome = { kind: 'error', message: i.discardError };
      }
      setDiscardArmed(false);
      setDiscardResult(outcome);
      setPendingKind(null);
      if (outcome.kind === 'discarded') setDiscarded(true);
    });
  }

  function discard(): void {
    setResult(null);
    setDiscardResult(null);
    if (!discardArmed) {
      setDiscardArmed(true);
      return;
    }
    executeDiscard();
  }

  function cancelDiscard(): void {
    setDiscardArmed(false);
    requestAnimationFrame(() => discardTriggerRef.current?.focus());
  }

  if (discarded) {
    return (
      <section
        ref={outcomeRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-admin-outcome="discarded"
        className="border-line bg-surface focus:outline-focus flex flex-col gap-2 rounded-md border p-4 focus:outline-2 focus:outline-offset-2"
      >
        <p className="text-ink text-sm">{i.discarded}</p>
      </section>
    );
  }

  if (result?.kind === 'confirmed') {
    return (
      <section
        ref={outcomeRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-admin-outcome="confirmed"
        className="border-money/40 bg-surface focus:outline-focus flex flex-col gap-2 rounded-md border p-4 focus:outline-2 focus:outline-offset-2"
      >
        <p className="text-money text-sm font-medium">{i.confirmed}</p>
        <Link
          href={`/projects/${result.projectSlug}`}
          className="text-ink-strong inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
        >
          {copy.projects.title} → {programName}
        </Link>
      </section>
    );
  }

  const blockedReason = result?.kind === 'unavailable' ? result.reason : null;
  const errorMessage = result?.kind === 'error' ? result.message : null;
  const discardMessage =
    discardResult?.kind === 'unavailable'
      ? discardResult.reason || i.discardUnavailable
      : discardResult?.kind === 'error'
        ? discardResult.message || i.discardError
        : null;
  const outcomeMessage = errorMessage ?? blockedReason ?? discardMessage;
  const outcomeKind =
    result?.kind === 'error'
      ? 'confirm-error'
      : result?.kind === 'unavailable'
        ? 'confirm-unavailable'
        : discardResult?.kind === 'error'
          ? 'discard-error'
          : discardResult?.kind === 'unavailable'
            ? 'discard-unavailable'
            : null;

  return (
    <section
      data-admin-pending={isPending ? 'true' : 'false'}
      aria-busy={isPending}
      className="border-line bg-surface flex flex-col gap-3 rounded-md border p-4"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={isPending || !readyToConfirm}
          aria-describedby={statusId}
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
            ref={discardTriggerRef}
            type="button"
            onClick={discard}
            disabled={isPending}
            className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {discardArmed ? i.confirmDiscard : i.discard}
          </button>
        )}
        {discardArmed ? (
          <button
            type="button"
            onClick={cancelDiscard}
            disabled={isPending}
            className="text-muted hover:text-ink ease-firma flex min-h-11 items-center px-2 text-xs underline decoration-dotted underline-offset-4 transition-colors duration-150"
          >
            {i.cancelDiscard}
          </button>
        ) : null}
      </div>
      {isPending && pendingKind !== null ? (
        <p
          ref={pendingStatusRef}
          id={statusId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-admin-pending-status={pendingKind}
          className="text-ink text-xs"
        >
          {pendingKind === 'confirm' ? i.confirmPending : i.discardPending}
        </p>
      ) : outcomeMessage === null ? (
        <p id={statusId} className="text-muted text-xs">
          {discardArmed ? i.discardWarning : i.confirmHint}
        </p>
      ) : (
        <p
          ref={(node) => {
            outcomeRef.current = node;
          }}
          id={statusId}
          tabIndex={-1}
          role={outcomeKind?.endsWith('error') ? 'alert' : 'status'}
          aria-live={outcomeKind?.endsWith('error') ? 'assertive' : 'polite'}
          aria-atomic="true"
          data-admin-outcome={outcomeKind}
          className="text-attention focus:outline-focus text-xs focus:outline-2 focus:outline-offset-2"
        >
          {outcomeMessage}
        </p>
      )}
      {errorMessage === null ? null : (
        <button
          type="button"
          onClick={confirm}
          disabled={isPending}
          className="text-attention hover:text-ink-strong ease-firma flex min-h-11 items-center text-xs underline decoration-dotted underline-offset-4 transition-colors duration-150"
        >
          {i.retry}
        </button>
      )}
      {discardMessage === null ? null : (
        <button
          type="button"
          onClick={executeDiscard}
          disabled={isPending}
          className="text-attention hover:text-ink-strong ease-firma flex min-h-11 items-center text-xs underline decoration-dotted underline-offset-4 transition-colors duration-150 disabled:cursor-not-allowed"
        >
          {i.retryDiscard}
        </button>
      )}
    </section>
  );
}
