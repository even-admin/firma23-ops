import { notFound } from 'next/navigation';

import { Amount } from '@/components/money/Amount';
import { CashLedger } from '@/components/finance/CashLedger';
import { RailBaseExplainer } from '@/components/revenue-rail/RailBaseExplainer';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { syntheticFinanceRepository } from '@/data/repositories/synthetic/finance';
import { cn } from '@/lib/cn';
import { formatBasisPoints } from '@/lib/money';
import { isFounder } from '@/lib/viewer';

/**
 * Rail context 4 of 5: settlement approval.
 *
 * Read-only. M1 has no write path of any kind, so the approve control is disabled
 * with the reason stated rather than wired to nothing.
 */
export default async function SettlePage({
  params,
}: {
  readonly params: Promise<{ readonly opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const viewer = await getViewer();

  if (!isFounder(viewer)) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
        <h1 className="text-ink-strong mb-6 text-2xl font-medium tracking-tight">
          {copy.settle.title}
        </h1>
        <PermissionDenied detail={copy.viewer.warning} />
      </div>
    );
  }

  const preview = await syntheticFinanceRepository.getSettlementPreview(opportunityId, viewer);
  if (preview === null) notFound();

  const alreadyApproved = preview.rail.kind === 'settlement';
  const checks: readonly {
    readonly label: string;
    readonly value: string;
    readonly ok: boolean;
  }[] = [
    // One row per member_pool — settlement readiness requires every pool to
    // be independently balanced, never a single figure aggregated across
    // all of them (SETY's closer and delivery pools each need their own row).
    ...preview.pools.map((pool) => ({
      label: `${pool.label} — ${copy.settle.checkWeights}`,
      value: formatBasisPoints(pool.totalBp),
      ok: pool.balanced,
    })),
    {
      label: copy.settle.checkMilestones,
      value: String(preview.milestonesOutstanding),
      ok: preview.milestonesOutstanding === 0,
    },
    {
      label: copy.settle.checkBase,
      value: '',
      ok: preview.distributableBase.amount > 0,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-2">
        <p className="label-micro text-faint">{copy.settle.title}</p>
        <h1 className="text-ink-strong text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
          {preview.opportunity.beneficiaryName}
        </h1>
        <p className="text-faint text-sm">
          {preview.opportunity.code} · {preview.opportunity.projectName}
        </p>
        <p className="text-muted text-sm">{copy.settle.subtitle}</p>
      </header>

      <RailBaseExplainer
        base={preview.distributableBase}
        policyLabel={preview.basePolicyLabel}
        policyNote={preview.basePolicyNote}
        cashReceived={preview.distributableBase}
      />

      <RevenueRail model={preview.rail} variant="approval" />

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.settle.checks}</h2>
        <ul className="flex flex-col gap-2">
          {checks.map((check) => (
            <li
              key={check.label}
              className="border-line bg-surface flex flex-wrap items-center gap-x-3 rounded-md border p-3"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  check.ok ? 'bg-money' : 'bg-attention',
                )}
              />
              <span className="text-ink min-w-0 flex-1 text-sm">{check.label}</span>
              <span className={cn('tnum text-sm', check.ok ? 'text-money' : 'text-attention')}>
                {check.value}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-line bg-surface flex flex-col gap-3 rounded-md border p-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="label-micro text-faint">{copy.money.base}</span>
          <Amount
            value={preview.distributableBase}
            className="text-ink-strong text-lg font-medium"
          />
        </div>
        <button
          type="button"
          disabled
          aria-describedby="approval-blocked"
          className="border-line text-faint w-full cursor-not-allowed rounded-md border px-4 py-3 text-sm font-medium sm:w-auto"
        >
          {copy.settle.approve}
        </button>
        <p id="approval-blocked" className="text-muted text-xs">
          {alreadyApproved ? copy.settle.alreadyApproved : preview.approvalBlockedReason}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.detail.ledger}</h2>
        <CashLedger events={preview.cashEvents} />
      </section>
    </div>
  );
}
