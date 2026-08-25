import { copy } from '@/copy/es-MX';
import type { ViewerRole } from '@/lib/viewer';

interface SessionPanelProps {
  readonly role: ViewerRole;
  readonly action: () => void | Promise<void>;
}

const ROLE_LABEL: Record<ViewerRole, string> = {
  founder: copy.viewer.founder,
  member: copy.viewer.member,
};

/**
 * Real-session counterpart to ViewerSwitcher. There is no role toggle here —
 * role comes from Postgres membership, not a control the browser can set —
 * so this only ever shows who is signed in and offers to sign out.
 */
export function SessionPanel({ role, action }: SessionPanelProps) {
  return (
    <form action={action} className="flex flex-col gap-2">
      <span className="label-micro text-rail-faint">{copy.auth.signedInAs}</span>
      <p className="text-rail-ink text-sm font-medium">{ROLE_LABEL[role]}</p>
      <button
        type="submit"
        className="border-rail-line-strong text-rail-muted hover:bg-rail-hover hover:text-rail-ink ease-firma min-h-11 rounded-md border px-3 text-xs font-medium transition-colors duration-150"
      >
        {copy.auth.signOut}
      </button>
    </form>
  );
}
