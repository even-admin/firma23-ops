'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { approveSettlementAction } from '@/app/(network)/admin/finance/[opportunityId]/settle/actions';
import { copy } from '@/copy/es-MX';
import type { ApproveSettlementInput, ApproveSettlementResult } from '@/types/views';

interface ApproveSettlementControlProps {
  readonly opportunityId: string;
  readonly readyToApprove: boolean;
  readonly disabledReason: string;
  readonly approveAction?: (input: ApproveSettlementInput) => Promise<ApproveSettlementResult>;
}

const c = copy.settle;

/**
 * Approval receives no amount, allocation, recipient, or settlement id from
 * the browser. Postgres derives and validates all settlement facts from the
 * opportunity's existing immutable rule, ledger and assignments.
 */
export function ApproveSettlementControl({
  opportunityId,
  readyToApprove,
  disabledReason,
  approveAction = approveSettlementAction,
}: ApproveSettlementControlProps) {
  const [result, setResult] = useState<ApproveSettlementResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const keyRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (result !== null) outcomeRef.current?.focus();
  }, [result]);

  function idempotencyKey(): string {
    const storageKey = `firma23.approve-settlement:${opportunityId}`;
    const persisted = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(storageKey);
    const key = keyRef.current ?? persisted ?? crypto.randomUUID();
    keyRef.current = key;
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(storageKey, key);
    return key;
  }

  function approve(): void {
    if (!readyToApprove || isPending || result?.kind === 'approved') return;
    setResult(null);
    startTransition(async () => {
      let outcome: ApproveSettlementResult;
      try {
        outcome = await approveAction({ opportunityId, idempotencyKey: idempotencyKey() });
      } catch {
        outcome = { kind: 'error', message: c.error };
      }
      setResult(outcome);
      if (outcome.kind === 'approved') {
        keyRef.current = null;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(`firma23.approve-settlement:${opportunityId}`);
        }
        router.refresh();
      }
    });
  }

  const message =
    result?.kind === 'approved'
      ? c.approved
      : result?.kind === 'unavailable'
        ? result.reason
        : result?.kind === 'error'
          ? result.message
          : disabledReason;

  return (
    <section aria-busy={isPending} className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={!readyToApprove || isPending || result?.kind === 'approved'}
        onClick={approve}
        className="glass-action-button ease-firma flex min-h-11 w-full items-center rounded-md border px-4 py-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isPending ? c.approving : c.approve}
      </button>
      <p
        ref={outcomeRef}
        tabIndex={result === null ? undefined : -1}
        role={result?.kind === 'error' ? 'alert' : 'status'}
        aria-live={result?.kind === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        className="text-muted focus:outline-focus text-xs focus:outline-2 focus:outline-offset-2"
      >
        {isPending ? c.approving : message}
      </p>
    </section>
  );
}
