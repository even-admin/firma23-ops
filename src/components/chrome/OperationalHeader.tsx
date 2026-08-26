import Link from 'next/link';

import { ChromeIcon } from '@/components/chrome/NavIcon';
import { Amount } from '@/components/money/Amount';
import { IdentityOrb } from '@/components/operator/IdentityOrb';
import { StatusPill } from '@/components/opportunity/StatusPill';
import { MeshDriftCanvas } from '@/components/visual/MeshDriftCanvas';
import { copy } from '@/copy/es-MX';
import type { HomeAssignment, MemberMoney, NextAction } from '@/types/views';

interface OperationalHeaderProps {
  readonly memberId: string;
  readonly displayName: string;
  readonly money: MemberMoney;
  readonly activeWorkCount: number;
  readonly primaryAssignment?: HomeAssignment | undefined;
  readonly primaryAction?: NextAction | undefined;
  readonly canOpenOpportunity: boolean;
}

/**
 * Home is a working table, not a KPI wall. The active opportunity owns the
 * visual field while the member ledger remains a separate authority record.
 */
export function OperationalHeader({
  memberId,
  displayName,
  money,
  activeWorkCount,
  primaryAssignment,
  primaryAction,
  canOpenOpportunity,
}: OperationalHeaderProps) {
  const paidShare =
    money.approved.amount > 0
      ? Math.min(100, Math.round((money.paid.amount / money.approved.amount) * 100))
      : 0;
  const assignmentHref =
    primaryAssignment === undefined
      ? canOpenOpportunity
        ? '/opportunities'
        : '/projects'
      : `/opportunities/${primaryAssignment.opportunityId}`;

  return (
    <header className="min-w-0">
      <div className="mb-5 flex min-w-0 items-center justify-between gap-4 sm:mb-7">
        <div className="flex min-w-0 items-center gap-3">
          <IdentityOrb memberId={memberId} size="card" className="size-9" />
          <div className="min-w-0">
            <p className="text-faint text-xs">{copy.home.greeting}</p>
            <h1 className="text-ink-strong truncate text-2xl font-medium sm:text-3xl">
              {displayName}
            </h1>
          </div>
        </div>
        <p className="text-faint hidden text-right text-xs sm:block">
          <span className="tnum text-ink-strong font-mono">{activeWorkCount}</span>{' '}
          {activeWorkCount === 1 ? copy.home.unitActive : copy.home.unitsActive}
        </p>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.55fr)]">
        <section className="studio-focus border-line bg-surface min-w-0 overflow-hidden border">
          {primaryAssignment === undefined ? (
            <div className="flex min-h-[28rem] flex-col justify-between p-6 sm:p-8">
              <div>
                <p className="text-faint text-xs">{copy.home.workInFocus}</p>
                <h2 className="text-ink-strong mt-3 max-w-xl text-3xl leading-tight font-medium sm:text-5xl">
                  {copy.home.noAssignments}
                </h2>
                <p className="text-muted mt-4 max-w-lg text-sm leading-6">
                  {copy.home.noAssignmentsDetail}
                </p>
              </div>
              <Link
                href={assignmentHref}
                className="mt-8 inline-flex min-h-12 w-fit items-center gap-3 text-sm font-medium"
              >
                <span>
                  {canOpenOpportunity ? copy.home.browseOpportunities : copy.home.browseProjects}
                </span>
                <span className="glass-orb-button flex size-11 items-center justify-center rounded-full">
                  <ChromeIcon name="chevron-right" />
                </span>
              </Link>
            </div>
          ) : (
            <div className="grid min-h-[28rem] min-w-0 md:grid-cols-[minmax(0,1.08fr)_minmax(16rem,0.92fr)]">
              <div className="flex min-w-0 flex-col p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-faint font-mono text-xs">{primaryAssignment.code}</p>
                  <StatusPill status={primaryAssignment.status} />
                </div>

                <div className="my-auto py-8">
                  <p className="text-faint text-xs">{copy.home.workInFocus}</p>
                  <h2 className="text-ink-strong mt-3 max-w-2xl text-3xl leading-[1.08] font-medium sm:text-5xl">
                    {primaryAssignment.projectName}
                  </h2>
                  <p className="text-muted mt-4 max-w-xl text-base leading-7">
                    {primaryAssignment.serviceName} · {primaryAssignment.roleLabel}
                  </p>
                  <p className="text-faint mt-2 text-sm">
                    {primaryAssignment.beneficiaryName} · {primaryAssignment.beneficiaryLocation}
                  </p>
                </div>

                <div className="border-line flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-faint text-xs">{copy.home.nextMove}</p>
                    <p className="text-ink mt-1 truncate text-sm font-medium">
                      {primaryAction?.label ?? copy.home.openOpportunity}
                    </p>
                    {primaryAction === undefined ? null : (
                      <p className="text-faint mt-1 truncate text-xs">{primaryAction.detail}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    {primaryAction?.key.startsWith('evidence:') ? (
                      <>
                        <button
                          type="button"
                          disabled
                          aria-describedby="home-evidence-unavailable"
                          className="border-line text-faint flex min-h-11 cursor-not-allowed items-center rounded-[var(--radius-control)] border px-4 text-sm font-medium"
                        >
                          {copy.home.primaryAction}
                        </button>
                        <p
                          id="home-evidence-unavailable"
                          className="text-faint max-w-64 text-left text-xs leading-5 sm:text-right"
                        >
                          {copy.home.primaryActionUnavailable}
                        </p>
                      </>
                    ) : null}
                    {canOpenOpportunity ? (
                      <Link
                        href={assignmentHref}
                        className="inline-flex min-h-12 items-center gap-3 text-sm font-medium"
                      >
                        <span>{copy.home.openOpportunity}</span>
                        <span className="glass-orb-button flex size-11 items-center justify-center rounded-full">
                          <ChromeIcon name="chevron-right" />
                        </span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="relative min-h-48 overflow-hidden border-t border-line md:min-h-0 md:border-t-0 md:border-l">
                <MeshDriftCanvas />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between p-5 text-xs text-paper-000 sm:p-6">
                  <span className="font-mono">F23 / {primaryAssignment.code}</span>
                  <span>{copy.home.projectField}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section
          className="authority-record border-line bg-surface flex min-w-0 flex-col border p-5 sm:p-6"
          data-money-state="approved"
          data-mobile-nav-clearance
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-faint text-xs">{copy.home.privateLedger}</p>
              <h2 className="text-ink-strong mt-1 text-lg font-medium">{copy.home.approvedLedger}</h2>
            </div>
            <span className="text-faint font-mono text-xs">{copy.home.snapshot}</span>
          </div>

          <p className="text-money tnum mt-8 text-4xl font-medium sm:text-5xl">
            <Amount value={money.approved} />
          </p>

          <div className="mt-8">
            <div
              className="border-line bg-raised h-1.5 overflow-hidden rounded-full border"
              role="img"
              aria-label={`${copy.home.paid}: ${paidShare}%`}
            >
              <span aria-hidden="true" className="bg-money block h-full" style={{ width: `${paidShare}%` }} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-5">
              <div>
                <dt className="text-faint text-xs">{copy.home.paid}</dt>
                <dd className="text-ink-strong tnum mt-1 text-base font-medium">
                  <Amount value={money.paid} />
                </dd>
              </div>
              <div>
                <dt className="text-faint text-xs">{copy.home.pendingPayout}</dt>
                <dd className="text-ink-strong tnum mt-1 text-base font-medium">
                  <Amount value={money.approvedUnpaid} />
                </dd>
              </div>
              {money.recovery.amount === 0 ? null : (
                <div className="col-span-2" data-money-state="recovery">
                  <dt className="text-attention text-xs">{copy.finance.recovery}</dt>
                  <dd className="text-ink-strong tnum mt-1 text-base font-medium">
                    <Amount value={money.recovery} />
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="border-line mt-auto border-t pt-5" data-money-state="projected">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-faint text-xs">{copy.home.projectedAside}</p>
              <p className="text-muted tnum text-sm font-medium">
                <Amount value={money.projected} />
              </p>
            </div>
            <p className="text-faint mt-2 text-xs leading-5">{copy.money.notEarnedYet}</p>
          </div>
        </section>
      </div>
    </header>
  );
}
