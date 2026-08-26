'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { createManualContractSetupAction } from '@/app/(network)/admin/intake-actions';
import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import { money } from '@/lib/money';
import type {
  AssignmentPickerMember,
  ManualContractSetupInput,
  ManualContractSetupResult,
} from '@/types/views';

interface ManualContractFormProps {
  readonly members: readonly AssignmentPickerMember[];
  readonly onCancel: () => void;
  readonly createAction?: (input: ManualContractSetupInput) => Promise<ManualContractSetupResult>;
}

const i = copy.admin.intake;

interface AssignmentRowState {
  readonly key: string;
  readonly memberId: string;
  readonly roleLabel: string;
  readonly weightPercent: string;
}

function parseMxCentavos(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [major = '', minor = ''] = trimmed.split('.');
  const value = Number(`${major}${minor.padEnd(2, '0')}`);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function percentToBp(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  const bp = Math.round(value * 100);
  return Number.isInteger(bp) && bp >= 0 && bp <= 10_000 ? bp : null;
}

export function ManualContractForm({
  members,
  onCancel,
  createAction = createManualContractSetupAction,
}: ManualContractFormProps) {
  const [clientName, setClientName] = useState('');
  const [contractName, setContractName] = useState('');
  const [serviceScope, setServiceScope] = useState('');
  const [projectedBase, setProjectedBase] = useState('');
  const [firma23Share, setFirma23Share] = useState('30');
  const [assignments, setAssignments] = useState<AssignmentRowState[]>([
    {
      key: 'assignment-1',
      memberId: members[0]?.memberId ?? '',
      roleLabel: '',
      weightPercent: '100',
    },
  ]);
  const [result, setResult] = useState<ManualContractSetupResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const clientId = useId();
  const contractId = useId();
  const scopeId = useId();
  const baseId = useId();
  const firmaShareId = useId();
  const clientRef = useRef<HTMLInputElement>(null);
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const attemptFallbackCounter = useRef(0);
  const assignmentKeyCounter = useRef(1);
  const router = useRouter();

  useEffect(() => {
    clientRef.current?.focus();
  }, []);

  useEffect(() => {
    if (result !== null) outcomeRef.current?.focus();
  }, [result]);

  const parsedBase = parseMxCentavos(projectedBase);
  const parsedFirmaShare = percentToBp(firma23Share);
  const parsedAssignments = useMemo(
    () =>
      assignments.map((assignment) => ({
        ...assignment,
        weightBp: percentToBp(assignment.weightPercent),
      })),
    [assignments],
  );
  const teamWeightTotal = parsedAssignments.reduce((sum, row) => sum + (row.weightBp ?? 0), 0);
  const memberIds = parsedAssignments.map((row) => row.memberId).filter(Boolean);
  const duplicateMember = new Set(memberIds).size !== memberIds.length;
  const readyToSubmit =
    clientName.trim().length > 0 &&
    contractName.trim().length > 0 &&
    serviceScope.trim().length > 0 &&
    parsedBase !== null &&
    parsedFirmaShare !== null &&
    parsedAssignments.length > 0 &&
    parsedAssignments.every(
      (assignment) =>
        assignment.memberId !== '' &&
        assignment.roleLabel.trim().length > 0 &&
        assignment.weightBp !== null &&
        assignment.weightBp > 0,
    ) &&
    teamWeightTotal === 10_000 &&
    !duplicateMember;

  function updateAssignment(key: string, patch: Partial<AssignmentRowState>): void {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.key === key ? { ...assignment, ...patch } : assignment,
      ),
    );
  }

  function addAssignment(): void {
    assignmentKeyCounter.current += 1;
    setAssignments((current) => [
      ...current,
      {
        key: `assignment-${assignmentKeyCounter.current}`,
        memberId: members.find((member) => !current.some((row) => row.memberId === member.memberId))
          ?.memberId ?? '',
        roleLabel: '',
        weightPercent: '',
      },
    ]);
  }

  function submit(): void {
    if (!readyToSubmit || parsedBase === null || parsedFirmaShare === null) return;
    setResult(null);
    attemptFallbackCounter.current += 1;
    const idempotencyKey =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `manual-${attemptFallbackCounter.current}-${contractName}`;
    startTransition(async () => {
      const outcome = await createAction({
        clientName: clientName.trim(),
        contractName: contractName.trim(),
        serviceScope: serviceScope.trim(),
        projectedBaseCentavos: parsedBase,
        currency: 'MXN',
        firma23ShareBp: parsedFirmaShare as never,
        assignments: parsedAssignments.map((assignment) => ({
          memberId: assignment.memberId,
          roleLabel: assignment.roleLabel.trim(),
          weightBp: assignment.weightBp as never,
        })),
        idempotencyKey,
      });
      setResult(outcome);
      if (outcome.kind === 'created') router.push(`/opportunities/${outcome.opportunityId}`);
    });
  }

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

      <div className="grid gap-3 lg:grid-cols-2">
        <label htmlFor={clientId} className="flex flex-col gap-1">
          <span className="label-micro text-faint">{i.manualSponsorLabel}</span>
          <input
            ref={clientRef}
            id={clientId}
            name="clientName"
            type="text"
            autoComplete="organization"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
          />
        </label>
        <label htmlFor={contractId} className="flex flex-col gap-1">
          <span className="label-micro text-faint">{i.manualProgramLabel}</span>
          <input
            id={contractId}
            name="contractName"
            type="text"
            autoComplete="off"
            value={contractName}
            onChange={(event) => setContractName(event.target.value)}
            className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
          />
        </label>
      </div>

      <label htmlFor={scopeId} className="flex flex-col gap-1">
        <span className="label-micro text-faint">{i.manualServiceScopeLabel}</span>
        <textarea
          id={scopeId}
          name="serviceScope"
          value={serviceScope}
          onChange={(event) => setServiceScope(event.target.value)}
          className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-28 rounded-md border px-3 py-3 text-sm"
        />
      </label>

      <div className="grid gap-3 lg:grid-cols-2">
        <label htmlFor={baseId} className="flex flex-col gap-1">
          <span className="label-micro text-faint">{i.manualProjectedBaseLabel}</span>
          <input
            id={baseId}
            inputMode="decimal"
            value={projectedBase}
            onChange={(event) => setProjectedBase(event.target.value)}
            className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
          />
        </label>
        <label htmlFor={firmaShareId} className="flex flex-col gap-1">
          <span className="label-micro text-faint">{i.manualFirma23ShareLabel}</span>
          <input
            id={firmaShareId}
            inputMode="decimal"
            value={firma23Share}
            onChange={(event) => setFirma23Share(event.target.value)}
            className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="label-micro text-faint">{i.assignments}</h3>
          <button
            type="button"
            onClick={addAssignment}
            className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors duration-150"
          >
            {i.manualAddMember}
          </button>
        </div>
        {assignments.map((assignment, index) => (
          <div key={assignment.key} className="grid gap-2 md:grid-cols-[1.2fr_1fr_8rem_auto]">
            <label className="flex flex-col gap-1">
              <span className="label-micro text-faint">{i.manualMemberLabel}</span>
              <select
                value={assignment.memberId}
                onChange={(event) => updateAssignment(assignment.key, { memberId: event.target.value })}
                className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
              >
                <option value="">{i.manualMemberLabel}</option>
                {members.map((member) => (
                  <option key={member.memberId} value={member.memberId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-micro text-faint">{i.manualRoleLabel}</span>
              <input
                value={assignment.roleLabel}
                onChange={(event) => updateAssignment(assignment.key, { roleLabel: event.target.value })}
                className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-micro text-faint">{i.manualWeightLabel}</span>
              <input
                inputMode="decimal"
                value={assignment.weightPercent}
                onChange={(event) => updateAssignment(assignment.key, { weightPercent: event.target.value })}
                className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={assignments.length === 1}
              onClick={() =>
                setAssignments((current) => current.filter((row) => row.key !== assignment.key))
              }
              className="border-line text-faint hover:bg-raised ease-firma mt-5 min-h-11 rounded-md border px-3 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {i.manualRemoveMember} {index + 1}
            </button>
          </div>
        ))}
      </div>

      <div className="border-line bg-bg flex flex-col gap-2 rounded-md border p-3" data-rail-kind="projection">
        <p className="label-micro text-faint">{i.manualReview}</p>
        <p className="text-muted text-xs">
          {i.manualProjectedBaseLabel}:{' '}
          {parsedBase === null ? '-' : <Amount value={money(parsedBase)} className="text-muted" />}
        </p>
        <p className="text-muted text-xs">
          {i.manualFirma23ShareLabel}: {parsedFirmaShare === null ? '-' : `${parsedFirmaShare} bp`}
        </p>
        <p className="text-muted text-xs">{i.manualWeightLabel}: {teamWeightTotal} bp</p>
      </div>

      {readyToSubmit ? null : <p className="text-faint text-xs">{i.manualRequired}</p>}
      {duplicateMember ? <p className="text-attention text-xs">{i.manualError}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!readyToSubmit || isPending}
          onClick={submit}
          className="glass-action-button ease-firma flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? i.manualSubmitting : i.manualSubmit}
        </button>
        {result === null ? null : (
          <p
            ref={outcomeRef}
            tabIndex={-1}
            role="status"
            aria-atomic="true"
            className="text-muted focus:outline-focus rounded-sm text-sm focus:outline-2 focus:outline-offset-2"
          >
            {result.kind === 'created'
              ? i.manualCreated
              : result.kind === 'unavailable'
                ? result.reason
                : result.message}
          </p>
        )}
      </div>
    </section>
  );
}
