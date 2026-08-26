import { Amount } from '@/components/money/Amount';
import { MeshDriftCanvas } from '@/components/visual/MeshDriftCanvas';
import { IdentityOrb } from '@/components/operator/IdentityOrb';
import { copy } from '@/copy/es-MX';
import type { MemberMoney } from '@/types/views';
import { cn } from '@/lib/cn';

interface OperationalHeaderProps {
  readonly displayName: string;
  readonly memberId: string;
  readonly money: MemberMoney;
  readonly activeWorkCount: number;
  readonly activeAssignmentCodes?: readonly string[];
  readonly primaryActionLabel: string;
  readonly primaryActionEnabled: boolean;
  readonly primaryActionDescription: string;
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
  memberId,
  money,
  activeWorkCount,
  activeAssignmentCodes = [],
  primaryActionLabel,
  primaryActionEnabled,
  primaryActionDescription,
}: OperationalHeaderProps) {
  const paidShare =
    money.approved.amount > 0 ? Math.round((money.paid.amount / money.approved.amount) * 100) : 0;

  return (
    <header className="border-line bg-surface rounded-md border p-4 sm:p-5">
      <div className="mb-5 flex items-center gap-3">
        <IdentityOrb memberId={memberId} size="card" />
        <div className="min-w-0">
          <p className="label-micro text-faint">{copy.home.greeting}</p>
          <h1 className="text-ink-strong truncate text-xl font-medium tracking-[-0.025em] sm:text-2xl">
            {displayName}
          </h1>
        </div>
        <span className="label-micro border-line text-faint ml-auto hidden rounded-sm border px-2 py-1 sm:inline-flex">
          {copy.home.snapshot}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section
          className="border-line bg-bg flex min-h-52 flex-col justify-between rounded-md border p-4 sm:p-5"
          data-money-state="approved"
        >
          <div>
            <p className="label-micro text-faint">{copy.home.approved}</p>
            <p className="text-money mt-2 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
              <Amount value={money.approved} />
            </p>
          </div>

          <div className="mt-8">
            <div className="border-line-strong bg-surface flex h-2 overflow-hidden rounded-full border">
              <span
                aria-hidden="true"
                className="bg-money h-full"
                style={{ width: `${paidShare}%` }}
              />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <dt className="label-micro text-faint">{copy.home.paid}</dt>
                <dd className="text-ink-strong mt-1 text-base font-medium">
                  <Amount value={money.paid} />
                </dd>
              </div>
              <div>
                <dt className="label-micro text-faint">{copy.home.pendingPayout}</dt>
                <dd className="text-ink-strong mt-1 text-base font-medium">
                  <Amount value={money.approvedUnpaid} />
                </dd>
              </div>
              {money.recovery.amount === 0 ? null : (
                <div className="col-span-2" data-money-state="recovery">
                  <dt className="label-micro text-attention">{copy.finance.recovery}</dt>
                  <dd className="text-ink-strong mt-1 text-base font-medium">
                    <Amount value={money.recovery} />
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        <section className="border-line text-paper-000 relative flex min-h-52 flex-col justify-between overflow-hidden rounded-md border p-4 sm:p-5">
          <MeshDriftCanvas />
          <div className="bg-ink-950/10 absolute inset-0" aria-hidden="true" />
          <div className="relative">
            <p className="label-micro text-paper-100/80">{copy.home.actionQueue}</p>
            <p className="text-paper-000 mt-2 text-4xl font-medium tracking-[-0.04em]">
              <span className="tnum">{activeWorkCount}</span>
              <span className="text-paper-100/80 ml-2 text-sm font-normal">
                {copy.home.unitsActive}
              </span>
            </p>
          </div>

          {activeAssignmentCodes.length > 0 ? (
            <ul className="relative flex flex-wrap gap-2" aria-label={copy.home.assignments}>
              {activeAssignmentCodes.slice(0, 4).map((code) => (
                <li
                  key={code}
                  className="label-micro border-paper-000/50 text-paper-000 rounded-sm border px-2 py-1"
                >
                  {code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-paper-100/80 relative text-sm">{copy.home.noAssignments}</p>
          )}
        </section>
      </div>

      <section className="border-line bg-bg mt-3 flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Projected money lives in its own child, never beside approved money. */}
        <div data-money-state="projected">
          <p className="label-micro text-faint">{copy.home.projectedAside}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="text-muted text-base font-medium">
              <Amount value={money.projected} />
            </span>
            <span className="text-faint text-xs">{copy.money.notEarnedYet}</span>
          </p>
        </div>
        <div className="flex max-w-sm flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            disabled={!primaryActionEnabled}
            aria-describedby="home-primary-action-description"
            className={cn(
              'ease-firma min-h-11 rounded-md border px-4 text-sm font-medium transition-colors duration-150',
              primaryActionEnabled
                ? 'border-ink-950 bg-ink-950 text-paper-000 hover:bg-ink-900'
                : 'border-line-strong text-faint cursor-not-allowed',
            )}
          >
            {primaryActionLabel}
          </button>
          <p id="home-primary-action-description" className="text-faint text-xs sm:text-right">
            {primaryActionDescription}
          </p>
        </div>
      </section>
    </header>
  );
}
