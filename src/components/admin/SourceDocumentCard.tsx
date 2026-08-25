import { cn } from '@/lib/cn';

export type SourceDocumentCardState = 'selected' | 'processing' | 'ready' | 'error';

interface SourceDocumentCardProps {
  readonly fileName: string;
  /** The document's real business kind label from the server (e.g. "Propuesta"),
   * or null before extraction has returned one. Never guessed client-side. */
  readonly kindLabel: string | null;
  readonly extractedAt?: string | null;
  readonly state: SourceDocumentCardState;
  /** Caller-supplied, copy-driven caption (e.g. "Analizando documento…").
   * This component never invents its own status text. */
  readonly statusLabel?: string | null;
  /** Caller-supplied, copy-driven prefix (e.g. "Archivo seleccionado"),
   * rendered as "{label}: {fileName}". Optional so the ready-state packet
   * can show the bare filename once it is no longer merely "selected". */
  readonly fileNameLabel?: string | null;
}

/**
 * The selected/processed source document, presented as one packet rather
 * than a bare line of text. Only ever shows real values already known to
 * the caller — no fabricated size, author, page count, or file-type icon.
 */
export function SourceDocumentCard({
  fileName,
  kindLabel,
  extractedAt = null,
  state,
  statusLabel = null,
  fileNameLabel = null,
}: SourceDocumentCardProps) {
  return (
    <div
      className={cn(
        'border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3',
        state === 'error' && 'border-attention/50',
      )}
    >
      <span
        aria-hidden="true"
        className="border-line-strong text-faint flex size-9 shrink-0 items-center justify-center rounded-sm border"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M7 3h7l3 3v15H7z" strokeLinejoin="round" />
          <path d="M14 3v3h3" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-sm font-medium">
          {fileNameLabel === null ? fileName : `${fileNameLabel}: ${fileName}`}
        </span>
        {kindLabel === null && extractedAt === null ? null : (
          <span className="text-faint block truncate text-xs">
            {[kindLabel, extractedAt].filter((part) => part !== null).join(' · ')}
          </span>
        )}
      </span>
      {statusLabel === null ? null : (
        <span className="label-micro text-faint shrink-0">{statusLabel}</span>
      )}
    </div>
  );
}
