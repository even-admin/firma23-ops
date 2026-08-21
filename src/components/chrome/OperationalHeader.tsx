import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import type { MemberMoney } from '@/types/views';
import { cn } from '@/lib/cn';

interface OperationalHeaderProps {
  readonly displayName: string;
  readonly initials: string;
  readonly money: MemberMoney;
  readonly activeWorkCount: number;
  readonly primaryActionLabel: string;
  readonly primaryActionEnabled: boolean;
}

/**
 * One operational header instead of four disconnected KPI cards.
 *
 * Approved money leads because it is the only figure that is real. Projected money
 * sits below the divider, muted and labelled, so it can never be mistaken for a
 * balance.
 */
export function OperationalHeader({
  displayName,
  initials,
  money,
  activeWorkCount,
  primaryActionLabel,
  primaryActionEnabled,
}: OperationalHeaderProps) {
  return (
    <header className="border-line bg-surface rounded-lg border">
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="border-line-strong text-muted label-micro flex size-9 items-center justify-center rounded-full border font-medium"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="label-micro text-faint">{copy.home.greeting}</p>
            <h1 className="text-ink-strong truncate text-lg font-medium">{displayName}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          <div>
            <p className="label-micro text-faint">{copy.home.approved}</p>
            <p className="text-money mt-1 text-3xl font-medium sm:text-4xl">
              <Amount value={money.approved} />
            </p>
          </div>
          <div>
            <p className="label-micro text-faint">{copy.home.pendingPayout}</p>
            <p className="text-ink mt-1 text-2xl font-medium">
              <Amount value={money.approvedUnpaid} />
            </p>
          </div>
          <div>
            <p className="label-micro text-faint">{copy.home.activeWork}</p>
            <p className="text-ink tnum mt-1 text-2xl font-medium">
              {activeWorkCount}{' '}
              <span className="text-faint text-sm font-normal">{copy.home.unitsActive}</span>
            </p>
          </div>

          <button
            type="button"
            disabled={!primaryActionEnabled}
            className={cn(
              'ease-firma ml-auto min-h-11 rounded-md border px-4 text-sm font-medium transition-colors duration-150',
              primaryActionEnabled
                ? 'border-line-strong text-ink-strong hover:bg-raised'
                : 'border-line text-faint cursor-not-allowed',
            )}
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>

      {/* Projected money lives below the rule, never beside approved money. */}
      <div className="border-line flex flex-wrap items-baseline gap-x-3 border-t px-4 py-3 sm:px-6">
        <span className="label-micro text-faint">{copy.home.projectedAside}</span>
        <span className="text-muted text-base font-medium">
          <Amount value={money.projected} />
        </span>
        <span className="text-faint text-xs">{copy.money.notEarnedYet}</span>
      </div>
    </header>
  );
}
