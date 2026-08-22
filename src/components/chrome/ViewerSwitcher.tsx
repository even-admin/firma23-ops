import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { ViewerRole } from '@/lib/viewer';

interface ViewerSwitcherProps {
  readonly role: ViewerRole;
  readonly action: (formData: FormData) => void | Promise<void>;
}

const OPTIONS: readonly { readonly value: ViewerRole; readonly label: string }[] = [
  { value: 'founder', label: copy.viewer.founder },
  { value: 'member', label: copy.viewer.member },
];

/**
 * Prototype viewer selector, living in the sidebar's organisation panel.
 *
 * Marked as a prototype control on purpose, and it carries its own disclaimer so
 * the warning travels with the control wherever it is composed. Switching here
 * grants nothing; it only changes which viewer the synthetic repositories are
 * asked about. Real authorization is Row Level Security in M2, and this control
 * goes away then.
 */
export function ViewerSwitcher({ role, action }: ViewerSwitcherProps) {
  return (
    <form action={action} className="flex flex-col gap-2">
      <span className="label-micro text-rail-faint">{copy.viewer.label}</span>
      <div className="border-rail-line-strong bg-rail flex rounded-md border p-0.5" role="group">
        {OPTIONS.map((option) => {
          const active = option.value === role;
          return (
            <button
              key={option.value}
              type="submit"
              name="role"
              value={option.value}
              aria-pressed={active}
              className={cn(
                'ease-firma min-h-9 flex-1 rounded-sm px-3 text-xs font-medium transition-colors duration-150',
                active
                  ? 'bg-rail-ink text-rail'
                  : 'text-rail-muted hover:bg-rail-hover hover:text-rail-ink',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-rail-faint text-[11px] leading-snug">{copy.viewer.warning}</p>
    </form>
  );
}
