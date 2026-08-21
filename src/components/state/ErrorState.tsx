import { copy } from '@/copy/es-MX';

interface ErrorStateProps {
  readonly title?: string;
  readonly detail?: string;
  readonly onRetry?: () => void;
}

export function ErrorState({ title, detail, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-danger/40 bg-surface flex flex-col items-start gap-3 rounded-md border p-6"
    >
      <p className="text-ink text-sm font-medium">{title ?? copy.states.error}</p>
      {detail === undefined ? null : <p className="text-faint text-sm">{detail}</p>}
      {onRetry === undefined ? null : (
        <button
          type="button"
          onClick={onRetry}
          className="border-line-strong text-ink hover:bg-raised ease-firma min-h-11 rounded-md border px-4 text-sm transition-colors duration-150"
        >
          {copy.states.retry}
        </button>
      )}
    </div>
  );
}
