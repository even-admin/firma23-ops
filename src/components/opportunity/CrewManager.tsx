'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { replaceOpportunityCrewAction } from '@/app/(network)/opportunities/[opportunityId]/crew-actions';
import { copy } from '@/copy/es-MX';
import { sha256Hex } from '@/lib/manual-contract-request';
import type {
  AssignmentPickerMember,
  AssignmentView,
  PoolWeightView,
  ReplaceOpportunityCrewInput,
  ReplaceOpportunityCrewResult,
} from '@/types/views';

interface CrewManagerProps {
  readonly opportunityId: string;
  readonly pools: readonly PoolWeightView[];
  readonly assignments: readonly AssignmentView[];
  readonly members: readonly AssignmentPickerMember[];
  readonly replaceAction?: (input: ReplaceOpportunityCrewInput) => Promise<ReplaceOpportunityCrewResult>;
}

const c = copy.detail.crew;

interface CrewRowState {
  readonly key: string;
  readonly memberId: string;
  readonly roleLabel: string;
  readonly weightPercent: string;
}

function percentToBp(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  const bp = Math.round(value * 100);
  return Number.isInteger(bp) && bp >= 0 && bp <= 10_000 ? bp : null;
}

function bpToPercent(bp: number): string {
  return (bp / 100).toString();
}

/**
 * JSON, not delimiter concatenation, so a role label containing "|" can
 * never collide with a different member/weight split — same rationale as
 * canonicalManualContractSetupRequest. roleKey is included so the same
 * idempotency key reused against a different pool produces a different
 * fingerprint, matching the RPC's own fingerprint shape exactly.
 */
function canonicalCrewRequest(
  opportunityId: string,
  roleKey: string,
  assignments: readonly { memberId: string; roleLabel: string; weightBp: number }[],
): string {
  return JSON.stringify({
    opportunityId,
    roleKey,
    assignments: [...assignments]
      .map((assignment) => ({
        memberId: assignment.memberId,
        roleLabel: assignment.roleLabel.trim(),
        weightBp: assignment.weightBp,
      }))
      .sort(
        (left, right) =>
          left.memberId.localeCompare(right.memberId) ||
          left.roleLabel.localeCompare(right.roleLabel) ||
          left.weightBp - right.weightBp,
      ),
  });
}

function initialRows(currentAssignments: readonly AssignmentView[], members: readonly AssignmentPickerMember[]): CrewRowState[] {
  if (currentAssignments.length > 0) {
    return currentAssignments.map((assignment, index) => ({
      key: `existing-${index}`,
      memberId: assignment.memberId,
      roleLabel: assignment.roleLabel,
      weightPercent: bpToPercent(assignment.weightBp),
    }));
  }
  return [{ key: 'row-1', memberId: members[0]?.memberId ?? '', roleLabel: '', weightPercent: '100' }];
}

/**
 * One independent editor per real pool (a member_pool allocation share on
 * the opportunity's own rule version, from the existing view-model data —
 * never inferred from which pools happen to have assignments today). Each
 * instance owns its own React state, so editing one pool cannot mutate
 * another's rows, totals, pending state, or idempotency key by
 * construction — there is no shared state between instances.
 */
export function CrewManager({
  opportunityId,
  pools,
  assignments,
  members,
  replaceAction = replaceOpportunityCrewAction,
}: CrewManagerProps) {
  if (pools.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {pools.map((pool) => (
        <PoolCrewManager
          key={pool.key}
          opportunityId={opportunityId}
          poolKey={pool.key}
          poolLabel={pool.label}
          currentAssignments={assignments.filter((assignment) => assignment.roleKey === pool.key)}
          members={members}
          replaceAction={replaceAction}
        />
      ))}
    </div>
  );
}

interface PoolCrewManagerProps {
  readonly opportunityId: string;
  readonly poolKey: string;
  readonly poolLabel: string;
  readonly currentAssignments: readonly AssignmentView[];
  readonly members: readonly AssignmentPickerMember[];
  readonly replaceAction?: (input: ReplaceOpportunityCrewInput) => Promise<ReplaceOpportunityCrewResult>;
}

function PoolCrewManager({
  opportunityId,
  poolKey,
  poolLabel,
  currentAssignments,
  members,
  replaceAction = replaceOpportunityCrewAction,
}: PoolCrewManagerProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CrewRowState[]>(() => initialRows(currentAssignments, members));
  const [result, setResult] = useState<ReplaceOpportunityCrewResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const rowKeyCounter = useRef(rows.length);
  const attemptByFingerprint = useRef(new Map<string, string>());
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const headingId = useId();
  const router = useRouter();

  useEffect(() => {
    if (result !== null) outcomeRef.current?.focus();
  }, [result]);

  const parsedRows = useMemo(
    () => rows.map((row) => ({ ...row, weightBp: percentToBp(row.weightPercent) })),
    [rows],
  );
  const totalBp = parsedRows.reduce((sum, row) => sum + (row.weightBp ?? 0), 0);
  const memberIds = parsedRows.map((row) => row.memberId).filter(Boolean);
  const duplicateMember = new Set(memberIds).size !== memberIds.length;
  const readyToSubmit =
    parsedRows.length > 0 &&
    parsedRows.every(
      (row) => row.memberId !== '' && row.roleLabel.trim().length > 0 && row.weightBp !== null && row.weightBp > 0,
    ) &&
    totalBp === 10_000 &&
    !duplicateMember;

  function updateRow(key: string, patch: Partial<CrewRowState>): void {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow(): void {
    rowKeyCounter.current += 1;
    setRows((current) => [
      ...current,
      {
        key: `row-${rowKeyCounter.current}`,
        memberId: members.find((member) => !current.some((row) => row.memberId === member.memberId))?.memberId ?? '',
        roleLabel: '',
        weightPercent: '',
      },
    ]);
  }

  function removeRow(key: string): void {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  function submit(): void {
    if (!readyToSubmit) return;
    const assignments = parsedRows.map((row) => ({
      memberId: row.memberId,
      roleLabel: row.roleLabel.trim(),
      weightBp: row.weightBp as never,
    }));
    setResult(null);
    startTransition(async () => {
      try {
        const fingerprint = await sha256Hex(canonicalCrewRequest(opportunityId, poolKey, assignments));
        const storageKey = `firma23.crew-replace-attempt:${fingerprint}`;
        const persisted = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(storageKey);
        const idempotencyKey = attemptByFingerprint.current.get(fingerprint) ?? persisted ?? crypto.randomUUID();
        attemptByFingerprint.current.set(fingerprint, idempotencyKey);
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(storageKey, idempotencyKey);

        const outcome = await replaceAction({ opportunityId, roleKey: poolKey, assignments, idempotencyKey });
        setResult(outcome);
        if (outcome.kind === 'replaced') {
          attemptByFingerprint.current.delete(fingerprint);
          if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(storageKey);
          setOpen(false);
          router.refresh();
        }
      } catch (error) {
        setResult({ kind: 'error', message: error instanceof Error ? error.message : c.error });
      }
    });
  }

  if (members.length === 0) {
    return <p className="text-faint text-sm">{c.noMembers}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 w-fit items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150"
      >
        {c.manage} · {poolLabel}
      </button>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isPending}
      className="border-line bg-surface flex flex-col gap-4 rounded-lg border p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-ink-strong text-lg font-medium">
            {c.title} · {poolLabel}
          </h2>
          <p className="text-faint text-sm">{c.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 shrink-0 items-center rounded-md border px-3 text-xs transition-colors duration-150"
        >
          {c.cancel}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const memberSelectId = `${headingId}-member-${row.key}`;
          const roleInputId = `${headingId}-role-${row.key}`;
          const weightInputId = `${headingId}-weight-${row.key}`;
          return (
            <div key={row.key} className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
              <label htmlFor={memberSelectId} className="flex flex-col gap-1">
                <span className="label-micro text-faint">{c.memberLabel}</span>
                <select
                  id={memberSelectId}
                  value={row.memberId}
                  onChange={(event) => updateRow(row.key, { memberId: event.target.value })}
                  className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
                >
                  <option value="">—</option>
                  {members.map((member) => (
                    <option key={member.memberId} value={member.memberId}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={roleInputId} className="flex flex-col gap-1">
                <span className="label-micro text-faint">{c.roleLabel}</span>
                <input
                  id={roleInputId}
                  type="text"
                  value={row.roleLabel}
                  onChange={(event) => updateRow(row.key, { roleLabel: event.target.value })}
                  className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
                />
              </label>
              <label htmlFor={weightInputId} className="flex flex-col gap-1">
                <span className="label-micro text-faint">{c.weightLabel}</span>
                <input
                  id={weightInputId}
                  type="text"
                  inputMode="decimal"
                  value={row.weightPercent}
                  onChange={(event) => updateRow(row.key, { weightPercent: event.target.value })}
                  className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 1}
                aria-label={c.removeMember}
                className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center self-end rounded-md border px-3 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {c.removeMember}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= members.length}
          className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {c.addMember}
        </button>
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="label-micro text-faint">{c.total}</span>
          <span className="tnum">{(totalBp / 100).toString()}%</span>
          <span className={totalBp === 10_000 ? 'text-faint' : 'text-attention'}>
            {totalBp === 10_000 ? c.totalBalanced : c.totalUnbalanced}
          </span>
        </p>
      </div>

      {readyToSubmit ? null : <p className="text-faint text-xs">{c.required}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!readyToSubmit || isPending}
          onClick={submit}
          className="glass-action-button ease-firma flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? c.submitting : c.submit}
        </button>
        {result === null ? null : (
          <p
            ref={outcomeRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-muted focus:outline-focus rounded-sm text-sm focus:outline-2 focus:outline-offset-2"
          >
            {result.kind === 'replaced' ? c.saved : result.kind === 'unavailable' ? result.reason : result.message}
          </p>
        )}
      </div>
    </section>
  );
}
