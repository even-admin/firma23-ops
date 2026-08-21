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
 * Prototype viewer selector.
 *
 * Marked as a prototype control on purpose. Switching here grants nothing; it only
 * changes which viewer the synthetic repositories are asked about. Real
 * authorization is Row Level Security in M2, and this control goes away then.
 */
export function ViewerSwitcher({ role, action }: ViewerSwitcherProps) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="label-micro text-faint">{copy.viewer.label}</span>
      <div className="border-line flex rounded-md border p-0.5" role="group">
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
                'ease-firma min-h-9 rounded-sm px-3 text-xs font-medium transition-colors duration-150',
                active ? 'bg-raised text-ink-strong' : 'text-muted hover:text-ink',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <span className="text-faint hidden text-xs lg:inline">{copy.viewer.warning}</span>
    </form>
  );
}
