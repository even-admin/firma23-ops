import { Amount } from '@/components/money/Amount';
import { ProgressionMeter } from '@/components/operator/ProgressionMeter';
import { MeshDriftCanvas } from '@/components/visual/MeshDriftCanvas';
import { copy } from '@/copy/es-MX';
import type { MemberMoney, ProgressionView } from '@/types/views';

interface OperationalHeaderProps {
  readonly displayName: string;
  readonly money: MemberMoney;
  readonly progression: ProgressionView;
  readonly activeWorkCount: number;
  readonly activeAssignmentCodes?: readonly string[];
}

/**
 * The Home arrival surface: one exact authority record beside one live system field.
 * Supporting amounts stay subordinate and projections remain an isolated subtree.
 */
export function OperationalHeader({
  displayName,
  money,
  progression,
  activeWorkCount,
  activeAssignmentCodes = [],
}: OperationalHeaderProps) {
  const paidShare =
    money.approved.amount > 0
      ? Math.min(100, Math.round((money.paid.amount / money.approved.amount) * 100))
      : 0;

  return (
    <header className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,1.08fr)]">
      <section
        className="border-line bg-surface flex min-h-[21rem] min-w-0 flex-col rounded-lg border p-5 sm:p-7"
        data-money-state="approved"
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="label-micro text-faint">{copy.home.greeting}</p>
            <h1 className="text-ink-strong mt-1 truncate text-xl font-medium sm:text-2xl">
              {displayName}
            </h1>
          </div>
          <span className="label-micro text-faint hidden sm:block">{copy.home.snapshot}</span>
        </div>

        <div className="mt-10">
          <p className="label-micro text-faint">{copy.home.approvedLedger}</p>
          <p className="text-money tnum mt-2 text-5xl font-medium sm:text-6xl">
            <Amount value={money.approved} />
          </p>
        </div>

        <div className="mt-auto pt-8">
          <div
            className="border-line bg-raised h-1.5 overflow-hidden rounded-full border"
            role="img"
            aria-label={`${copy.home.paid}: ${paidShare}%`}
          >
            <span aria-hidden="true" className="bg-money block h-full" style={{ width: `${paidShare}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
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

      <section
        className="border-line text-paper-000 relative flex min-h-[21rem] min-w-0 flex-col justify-between overflow-hidden rounded-lg border p-5 sm:p-7"
        data-mobile-nav-clearance
      >
        <MeshDriftCanvas />
        <div className="bg-ink-950/8 pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative flex items-start justify-between gap-4">
          <p className="label-micro text-paper-100/80">{copy.home.actionQueue}</p>
          <span className="label-micro border-paper-000/35 text-paper-000 rounded-full border px-3 py-1">
            {copy.home.liveNow}
          </span>
        </div>

        <div className="relative max-w-xl">
          <p className="tnum text-7xl font-medium sm:text-8xl">{activeWorkCount}</p>
          <p className="text-paper-100/85 mt-2 max-w-sm text-sm leading-6">
            {activeWorkCount === 1 ? copy.home.unitActive : copy.home.unitsActive}
          </p>
        </div>

        <div className="relative grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          {activeAssignmentCodes.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label={copy.home.assignments}>
              {activeAssignmentCodes.slice(0, 4).map((code) => (
                <li
                  key={code}
                  className="label-micro border-paper-000/45 bg-ink-950/15 text-paper-000 rounded-full border px-3 py-1.5"
                >
                  {code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-paper-100/80 text-sm">{copy.home.noAssignments}</p>
          )}
          <ProgressionMeter progression={progression} compact tone="glass" />
        </div>
      </section>

      <section
        className="border-line bg-surface flex min-w-0 flex-col gap-2 rounded-lg border px-5 py-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between sm:px-7"
        data-money-state="projected"
      >
        <div>
          <p className="label-micro text-faint">{copy.home.projectedAside}</p>
          <p className="text-muted mt-1 text-xl font-medium">
            <Amount value={money.projected} />
          </p>
        </div>
        <p className="text-faint max-w-md text-xs leading-5 sm:text-right">{copy.money.notEarnedYet}</p>
      </section>
    </header>
  );
}
