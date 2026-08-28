'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { createMemberInviteAction } from '@/app/(network)/admin/members/actions';
import { copy } from '@/copy/es-MX';
import { sha256Hex } from '@/lib/manual-contract-request';
import type { CreateMemberInviteInput, CreateMemberInviteResult } from '@/types/views';

interface InviteMemberFormProps {
  readonly createAction?: (input: CreateMemberInviteInput) => Promise<CreateMemberInviteResult>;
}

/**
 * JSON keeps ["a|b"] distinct from ["a", "b"]; matches the manual-contract
 * canonicalization so retries and reloads target the same stored key.
 */
function canonicalInviteRequest(displayName: string, email: string): string {
  return JSON.stringify({ displayName: displayName.trim(), email: email.trim().toLowerCase() });
}

export function InviteMemberForm({ createAction = createMemberInviteAction }: InviteMemberFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<CreateMemberInviteResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const nameId = useId();
  const emailId = useId();
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const attemptByFingerprint = useRef(new Map<string, string>());
  const router = useRouter();

  useEffect(() => {
    if (result !== null) outcomeRef.current?.focus();
  }, [result]);

  const ready = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function submit() {
    if (!ready) return;
    const displayName = name.trim();
    const trimmedEmail = email.trim();
    setResult(null);
    startTransition(async () => {
      try {
        const fingerprint = await sha256Hex(canonicalInviteRequest(displayName, trimmedEmail));
        const storageKey = `firma23.invite-member-attempt:${fingerprint}`;
        const persisted = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(storageKey);
        const idempotencyKey =
          attemptByFingerprint.current.get(fingerprint) ?? persisted ?? crypto.randomUUID();
        attemptByFingerprint.current.set(fingerprint, idempotencyKey);
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(storageKey, idempotencyKey);

        const outcome = await createAction({
          displayName,
          email: trimmedEmail,
          idempotencyKey,
        });
        setResult(outcome);
        if (outcome.kind === 'created') {
          attemptByFingerprint.current.delete(fingerprint);
          if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(storageKey);
          router.refresh();
        }
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
