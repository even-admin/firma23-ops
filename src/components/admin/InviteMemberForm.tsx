'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { createMemberInviteAction } from '@/app/(network)/admin/members/actions';
import { copy } from '@/copy/es-MX';
import type { CreateMemberInviteInput, CreateMemberInviteResult } from '@/types/views';

interface InviteMemberFormProps {
  readonly createAction?: (input: CreateMemberInviteInput) => Promise<CreateMemberInviteResult>;
}

export function InviteMemberForm({ createAction = createMemberInviteAction }: InviteMemberFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<CreateMemberInviteResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const nameId = useId();
  const emailId = useId();
  const outcomeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (result !== null) outcomeRef.current?.focus();
  }, [result]);

  const ready = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function submit() {
    if (!ready) return;
    setResult(null);
    startTransition(async () => {
      try {
        setResult(
          await createAction({
            displayName: name.trim(),
            email: email.trim(),
            idempotencyKey: crypto.randomUUID(),
          }),
        );
      } catch (error) {
        setResult({ kind: 'error', message: error instanceof Error ? error.message : copy.admin.members.error });
      }
    });
  }

  return (
    <section className="border-line bg-surface flex flex-col gap-4 rounded-lg border p-4 sm:p-6" aria-busy={isPending}>
      <div>
        <h2 className="text-ink-strong text-lg font-medium">{copy.admin.members.title}</h2>
        <p className="text-faint text-sm">{copy.admin.members.subtitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={nameId} className="flex flex-col gap-1">
          <span className="label-micro text-faint">{copy.admin.members.nameLabel}</span>
          <input id={nameId} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm" />
        </label>
        <label htmlFor={emailId} className="flex flex-col gap-1">
          <span className="label-micro text-faint">{copy.admin.members.emailLabel}</span>
          <input id={emailId} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="border-line-strong bg-surface text-ink focus-visible:outline-focus min-h-11 rounded-md border px-3 text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!ready || isPending} onClick={submit} className="glass-action-button ease-firma flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? copy.admin.members.creating : copy.admin.members.create}
        </button>
        {result === null ? null : <p ref={outcomeRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className="text-muted focus:outline-focus rounded-sm text-sm focus:outline-2 focus:outline-offset-2">{result.kind === 'created' ? copy.admin.members.created : result.kind === 'unavailable' ? result.reason : result.message}</p>}
      </div>
      <p className="text-faint text-xs">{copy.admin.members.deliveryNote}</p>
    </section>
  );
}
