import { copy } from '@/copy/es-MX';

interface PermissionDeniedProps {
  readonly detail?: string;
}

export function PermissionDenied({ detail }: PermissionDeniedProps) {
  return (
    <div
      data-permission-denied
      className="authority-record border-line bg-surface relative flex min-h-48 flex-col items-start justify-end gap-1 overflow-hidden border p-6 sm:p-8"
    >
      <span aria-hidden="true" className="bg-attention absolute inset-y-0 left-0 w-1" />
      <span aria-hidden="true" className="text-faint mb-auto font-mono text-xs">
        403 / privado
      </span>
      <p className="text-ink-strong text-lg font-medium">{copy.states.permissionDenied}</p>
      {detail === undefined ? null : <p className="text-muted max-w-xl text-sm">{detail}</p>}
    </div>
  );
}
