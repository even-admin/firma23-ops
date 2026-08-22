import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import type { FinanceTotals } from '@/types/views';

interface FinanceMetricCardProps {
  readonly totals: FinanceTotals;
  readonly pendingApprovals: number;
}

/**
 * Founder financial snapshot.
 *
 * This deliberately has no trend line: M1 has a current financial state but no
 * historical series. Approved base is the only amount receiving ledger green.
 */
export function FinanceMetricCard({ totals, pendingApprovals }: FinanceMetricCardProps) {
  return (
    <section
      aria-labelledby="finance-metric-title"
      className="border-line bg-surface overflow-hidden rounded-lg border"
    >
      <div className="grid lg:grid-cols-[1.15fr_1fr]">
        <div className="flex min-h-48 flex-col justify-between p-5 sm:p-6 lg:min-h-56 lg:p-8">
          <div>
            <h2 id="finance-metric-title" className="label-micro text-faint">
              {copy.finance.cashReceived}
            </h2>
            <p className="text-muted mt-2 max-w-sm text-sm">{copy.admin.subtitle}</p>
          </div>
          <p className="text-ink-strong mt-8 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
            <Amount value={totals.cashReceived} />
          </p>
        </div>

        <div className="border-line grid grid-cols-2 border-t lg:border-t-0 lg:border-l">
          <div className="border-line flex min-h-32 flex-col justify-between border-r p-5 sm:p-6 lg:min-h-56 lg:p-8">
            <p className="label-micro text-faint">{copy.finance.approvedBase}</p>
            <p className="text-money mt-6 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
              <Amount value={totals.distributableApproved} />
            </p>
          </div>
          <div className="flex min-h-32 flex-col justify-between p-5 sm:p-6 lg:min-h-56 lg:p-8">
            <p className="label-micro text-faint">{copy.finance.owed}</p>
            <p className="text-ink mt-6 text-2xl font-medium tracking-[-0.03em] sm:text-3xl">
              <Amount value={totals.owed} />
            </p>
          </div>
        </div>
      </div>

      <footer className="border-line bg-bg flex flex-wrap items-center gap-3 border-t px-5 py-3 sm:px-6 lg:px-8">
        <span className="label-micro text-faint">{copy.finance.pendingApprovals}</span>
        <span className="text-attention tnum text-sm font-semibold">{pendingApprovals}</span>
        <Link
          href="/admin/finance"
          className="border-line-strong text-ink-strong hover:bg-raised ease-firma ml-auto flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150"
        >
          {copy.finance.title}
        </Link>
      </footer>
    </section>
  );
}
