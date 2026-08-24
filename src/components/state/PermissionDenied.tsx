import { copy } from '@/copy/es-MX';

interface PermissionDeniedProps {
  readonly detail?: string;
}

export function PermissionDenied({ detail }: PermissionDeniedProps) {
  return (
    <div className="border-ink-850 bg-ink-950 flex min-h-48 flex-col items-start justify-end gap-1 rounded-lg border p-6 sm:p-8">
      <span aria-hidden="true" className="label-micro text-steel-500 mb-auto">
        403 / privado
      </span>
      <p className="text-paper-000 text-lg font-medium">{copy.states.permissionDenied}</p>
      {detail === undefined ? null : <p className="text-steel-400 max-w-xl text-sm">{detail}</p>}
    </div>
  );
}
