import { Suspense } from 'react';

import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { CashLedger } from '@/components/finance/CashLedger';
import { StatusPill } from '@/components/opportunity/StatusPill';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { getActiveOperationalFinanceRepository } from '@/data/repositories/active/operational-finance';
import { isFounder } from '@/lib/viewer';

async function FinanceBody() {
  const viewer = await getViewer();
  if (!isFounder(viewer)) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
        <h1 className="text-ink-strong mb-6 text-2xl font-medium tracking-tight">
          {copy.finance.title}
        </h1>
        <PermissionDenied detail={copy.viewer.warning} />
      </div>
    );
  }

  const overview = await (await getActiveOperationalFinanceRepository()).getOverview(viewer);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-3xl font-medium sm:text-4xl">
          {copy.finance.title}
        </h1>
        <p className="text-muted text-sm">{copy.finance.subtitle}</p>
      </header>

      {/*
        Approved and projected bases are separate columns, never a single total.
        Adding them would state something untrue about the business.
      */}
      <section className="border-line bg-surface rounded-lg border">
        <dl className="flex flex-wrap gap-x-10 gap-y-4 p-4 sm:p-6">
          <div data-money-state="cash-received">
            <dt className="label-micro text-faint">{copy.finance.cashReceived}</dt>
            <dd className="text-ink-strong mt-1 text-2xl font-medium">
              <Amount value={overview.totals.cashReceived} />
            </dd>
          </div>
          <div data-money-state="approved">
            <dt className="label-micro text-faint">{copy.finance.approvedBase}</dt>
            <dd className="text-money mt-1 text-2xl font-medium">
              <Amount value={overview.totals.distributableApproved} />
            </dd>
          </div>
          <div data-money-state="paid">
            <dt className="label-micro text-faint">{copy.finance.paidOut}</dt>
            <dd className="text-ink mt-1 text-2xl font-medium">
              <Amount value={overview.totals.paidOut} />
            </dd>
          </div>
          <div data-money-state="payable">
            <dt className="label-micro text-faint">{copy.finance.owed}</dt>
            <dd className="text-ink mt-1 text-2xl font-medium">
              <Amount value={overview.totals.owed} />
            </dd>
          </div>
          {overview.totals.recovery.amount === 0 ? null : (
            <div data-money-state="recovery">
              <dt className="label-micro text-attention">{copy.finance.recovery}</dt>
              <dd className="text-ink mt-1 text-2xl font-medium">
                <Amount value={overview.totals.recovery} />
              </dd>
            </div>
          )}
          <div data-money-state="approved-house">
            <dt className="label-micro text-faint">{copy.finance.house}</dt>
            <dd className="text-ink mt-1 text-2xl font-medium">
              <Amount value={overview.totals.houseApproved} />
            </dd>
          </div>
        </dl>
        <div
          className="border-line flex flex-wrap items-baseline gap-x-3 border-t px-4 py-3 sm:px-6"
          data-money-state="projected"
        >
          <span className="label-micro text-faint">{copy.finance.projectedBase}</span>
          <span className="text-muted text-base font-medium">
            <Amount value={overview.totals.distributableProjected} />
          </span>
          <span className="text-faint text-xs">{copy.money.notEarnedYet}</span>
        </div>
      </section>

      <ul className="flex flex-col gap-6">
        {overview.rows.map((row) => (
          <li
            key={row.opportunity.id}
            className="border-line bg-surface/40 flex flex-col gap-4 rounded-lg border p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h2 className="text-ink-strong truncate text-base font-medium">
                  <Link
                    href={`/opportunities/${row.opportunity.id}`}
                    className="hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                  >
                    {row.opportunity.beneficiaryName}
                  </Link>
                </h2>
                <p className="text-faint text-xs">
                  {row.opportunity.code} · {row.opportunity.projectName}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={row.opportunity.status} />
                <Link
                  href={`/admin/finance/${row.opportunity.id}/settle`}
                  className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors duration-150"
                >
                  {copy.finance.review}
                </Link>
              </div>
            </div>

            {/* Rail context 3 of 5: founder finance dashboard. */}
            <RevenueRail model={row.rail} variant="dashboard" />

            <details className="group">
              <summary className="label-micro text-faint hover:text-ink flex min-h-11 cursor-pointer list-none items-center">
                {copy.finance.ledger}
              </summary>
              <div className="pt-3">
                <CashLedger events={row.cashEvents} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

/*
 * Loading UI lives in a Suspense boundary inside the page, not a segment-level
 * loading.tsx. A loading.tsx anywhere above a dynamic route flushes the stream
 * immediately, which locks the response status at 200 and makes notFound() serve
 * the not-found UI with a 200 instead of a 404.
 */
export default function FinancePage() {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <FinanceBody />
    </Suspense>
  );
}

function LoadingWrap() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
      <LoadingBlock rows={4} />
    </div>
  );
}
