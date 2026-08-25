'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { ContractDraftSummary } from '@/components/admin/ContractDraftSummary';
import {
  IntakeStepper,
  type IntakeStepKey,
  type IntakeStepStatus,
} from '@/components/admin/IntakeStepper';
import { ManualContractForm } from '@/components/admin/ManualContractForm';
import { SourceDocumentCard } from '@/components/admin/SourceDocumentCard';
import { runIntakeAction } from '@/app/(network)/admin/intake-actions';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { ContractDraftView, IntakeRunView, RunIntakeInput } from '@/types/views';

interface DocumentIntakePanelProps {
  /** Injectable for tests, which have no Next.js request scope for cookies()
   * to read inside the real Server Action. Defaults to the real action. */
  readonly runIntake?: (input: RunIntakeInput) => Promise<IntakeRunView>;
}

type Phase = 'idle' | 'selected' | 'processing' | 'ready' | 'error';
type ErrorKind = 'validation' | 'server';

const i = copy.admin.intake;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt'];

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return i.fileTooLarge;
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return i.fileTypeUnsupported;
  return null;
}

/**
 * Derives the stepper's four statuses entirely from real phase/result state
 * — never a timer or decorative animation. `confirmed` only becomes true
 * after ConfirmContractControl reports a real 'confirmed' outcome.
 */
function stepStatuses(
  phase: Phase,
  errorKind: ErrorKind | null,
  confirmed: boolean,
): Record<IntakeStepKey, IntakeStepStatus> {
  if (phase === 'idle') {
    return {
      document: 'current',
      extraction: 'upcoming',
      review: 'upcoming',
      confirmation: 'upcoming',
    };
  }
  if (phase === 'error' && errorKind === 'validation') {
    return {
      document: 'current',
      extraction: 'upcoming',
      review: 'upcoming',
      confirmation: 'upcoming',
    };
  }
  if (phase === 'selected' || phase === 'processing' || phase === 'error') {
    return {
      document: 'complete',
      extraction: 'current',
      review: 'upcoming',
      confirmation: 'upcoming',
    };
  }
  return {
    document: 'complete',
    extraction: 'complete',
    review: confirmed ? 'complete' : 'current',
    confirmation: confirmed ? 'complete' : 'upcoming',
  };
}

/**
 * The document-first contract intake flow.
 *
 * Selecting and validating a file happens entirely client-side (real
 * validation: type and size, not simulated). Processing calls the real
 * runIntakeAction Server Action, which calls the active repository
 * (synthetic or Supabase, chosen by src/data/repositories/active/intake.ts)
 * — there is no setTimeout standing in for a network call here. The
 * deterministic local adapter always returns the same SETY fixture draft
 * regardless of which file was actually picked, and the ready state says so
 * explicitly; a live provider, once configured, would not have that
 * limitation, but neither exists as a credential in this environment.
 */
export function DocumentIntakePanel({ runIntake = runIntakeAction }: DocumentIntakePanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draft, setDraft] = useState<ContractDraftView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const manualOpenerRef = useRef<HTMLButtonElement | null>(null);
  const readyRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const attemptKeyRef = useRef<string | null>(null);
  const statusId = useId();

  useEffect(() => {
    if (phase === 'ready') readyRef.current?.focus();
    if (phase === 'error') errorRef.current?.focus();
  }, [phase]);

  function selectFile(file: File): void {
    const validationError = validateFile(file);
    setFileName(file.name);
    if (validationError !== null) {
      setErrorKind('validation');
      setErrorMessage(validationError);
      setPhase('error');
      return;
    }
    setErrorMessage(null);
    setErrorKind(null);
    setPhase('selected');
  }

  function reset(): void {
    setPhase('idle');
    setFileName(null);
    setDraft(null);
    setErrorMessage(null);
    setErrorKind(null);
    setConfirmed(false);
    attemptKeyRef.current = null;
    if (inputRef.current !== null) inputRef.current.value = '';
  }

  function closeManualForm(): void {
    setShowManualForm(false);
    requestAnimationFrame(() => manualOpenerRef.current?.focus());
  }

  async function process(): Promise<void> {
    if (fileName === null) return;
    setPhase('processing');
    attemptKeyRef.current ??=
      typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${fileName}`;

    let run: IntakeRunView;
    try {
      run = await runIntake({
        sourceDocumentFilename: fileName,
        idempotencyKey: attemptKeyRef.current,
      });
    } catch {
      setErrorKind('server');
      setErrorMessage(i.processingError);
      setPhase('error');
      return;
    }

    if (run.status === 'ready' && run.draft !== null) {
      setDraft(run.draft);
      setPhase('ready');
      return;
    }
    setErrorKind('server');
    setErrorMessage(run.errorMessage ?? i.fileTypeUnsupported);
    setPhase('error');
  }

  if (phase === 'ready' && draft !== null) {
    return (
      <section
        ref={readyRef}
        tabIndex={-1}
        aria-label={i.readyAnnouncement}
        className="border-line bg-surface focus:outline-focus flex flex-col gap-4 rounded-lg border p-4 focus:outline-2 focus:outline-offset-2 sm:p-6"
      >
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {i.readyAnnouncement}
        </p>
        <IntakeStepper statuses={stepStatuses(phase, errorKind, confirmed)} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-attention bg-attention/10 rounded-sm px-3 py-2 text-xs">
            {i.syntheticNotice}
          </p>
          <button
            type="button"
            onClick={reset}
            className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 shrink-0 items-center rounded-md border px-3 text-xs transition-colors duration-150"
          >
            {i.changeFile}
          </button>
        </div>
        <ContractDraftSummary draft={draft} onConfirmed={() => setConfirmed(true)} />
      </section>
    );
  }

  return (
    <>
      {showManualForm ? <ManualContractForm onCancel={closeManualForm} /> : null}
      <section
        hidden={showManualForm}
        aria-hidden={showManualForm || undefined}
        className="border-line bg-surface flex flex-col gap-4 rounded-lg border p-4 sm:p-6"
      >
        <IntakeStepper statuses={stepStatuses(phase, errorKind, confirmed)} />
        <h2 className="text-ink-strong text-lg font-medium">{i.ctaUpload}</h2>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0];
            if (file !== undefined) selectFile(file);
          }}
          className={cn(
            'flex min-h-36 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center transition-colors duration-150',
            isDragging ? 'border-ink-950 bg-raised' : 'border-line-strong',
          )}
        >
          {phase === 'idle' ? (
            <>
              <p className="text-ink text-sm font-medium">{i.dropTitle}</p>
              <p className="text-faint max-w-sm text-xs">{i.dropHint}</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="border-ink-950 bg-ink-950 text-paper-000 ease-firma hover:bg-ink-900 mt-1 flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150"
              >
                {i.chooseFile}
              </button>
              <input
                ref={inputRef}
                type="file"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file !== undefined) selectFile(file);
                }}
              />
            </>
          ) : (
            <div className="flex w-full flex-col items-center gap-3">
              <SourceDocumentCard
                fileName={fileName ?? ''}
                fileNameLabel={i.selectedFile}
                kindLabel={null}
                state={
                  phase === 'error' ? 'error' : phase === 'processing' ? 'processing' : 'selected'
                }
                statusLabel={phase === 'processing' ? i.processing : null}
              />

              {phase === 'error' ? (
                <p
                  ref={errorRef}
                  tabIndex={-1}
                  role="alert"
                  className="text-attention focus:outline-focus text-xs focus:outline-2 focus:outline-offset-2"
                >
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-center gap-2">
                {phase === 'error' && errorKind === 'validation' ? null : (
                  <button
                    type="button"
                    onClick={() => void process()}
                    disabled={phase === 'processing'}
                    className={cn(
                      'ease-firma flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150',
                      phase === 'processing'
                        ? 'border-line text-faint cursor-not-allowed'
                        : 'border-ink-950 bg-ink-950 text-paper-000 hover:bg-ink-900',
                    )}
                  >
                    {phase === 'processing'
                      ? i.processing
                      : phase === 'error'
                        ? i.retry
                        : i.process}
                  </button>
                )}
                <button
                  type="button"
                  onClick={reset}
                  disabled={phase === 'processing'}
                  className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {i.changeFile}
                </button>
              </div>
            </div>
          )}
        </div>

        <p role="status" aria-live="polite" id={statusId} className="sr-only">
          {phase === 'processing' ? i.processing : ''}
        </p>

        <p className="text-faint text-xs">
          <button
            ref={manualOpenerRef}
            type="button"
            onClick={() => setShowManualForm(true)}
            className="text-faint hover:text-ink inline-flex min-h-11 items-center underline decoration-dotted underline-offset-4"
          >
            {i.ctaManual}
          </button>{' '}
          · {i.ctaManualHint}
        </p>
      </section>
    </>
  );
}
