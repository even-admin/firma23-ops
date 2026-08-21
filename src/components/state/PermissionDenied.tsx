import { copy } from '@/copy/es-MX';

interface PermissionDeniedProps {
  readonly detail?: string;
}

export function PermissionDenied({ detail }: PermissionDeniedProps) {
  return (
    <div className="border-line bg-surface flex flex-col items-start gap-1 rounded-md border p-6">
      <p className="text-ink text-sm font-medium">{copy.states.permissionDenied}</p>
      {detail === undefined ? null : <p className="text-faint text-sm">{detail}</p>}
    </div>
  );
}
