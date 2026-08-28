import { notFound } from 'next/navigation';

import { Amount } from '@/components/money/Amount';
import { ApproveSettlementControl } from '@/components/finance/ApproveSettlementControl';
import { CashLedger } from '@/components/finance/CashLedger';
import { RailBaseExplainer } from '@/components/revenue-rail/RailBaseExplainer';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { getActiveOperationalFinanceRepository } from '@/data/repositories/active/operational-finance';
import { cn } from '@/lib/cn';
import { formatBasisPoints } from '@/lib/money';
import { isFounder } from '@/lib/viewer';

/**
 * Rail context 4 of 5: settlement approval.
 *
 * The browser submits only this opportunity id and an idempotency key. The
 * audited Postgres RPC derives every monetary fact at the authority boundary.
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

  const preview = await (await getActiveOperationalFinanceRepository()).getSettlementPreview(opportunityId, viewer);
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
  const readyToApprove = !alreadyApproved && checks.every((check) => check.ok);
  const disabledReason = alreadyApproved
    ? copy.settle.alreadyApproved
    : readyToApprove
      ? copy.settle.approvalReady
      : copy.settle.approvalNotReady;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-2">
        <p className="label-micro text-faint">{copy.settle.title}</p>
        <h1 className="text-ink-strong text-3xl font-medium sm:text-4xl">
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
        cashReceived={preview.cashReceived}
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
        <div className="flex flex-wrap items-baseline gap-x-3" data-rail-kind="projection">
          <span className="label-micro text-faint">{copy.money.projected}</span>
          <Amount value={preview.projectedDistributableBase} className="text-muted text-lg font-medium" />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="label-micro text-faint">{copy.money.cashReceived}</span>
          <Amount value={preview.cashReceived} className="text-ink text-lg font-medium" />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="label-micro text-faint">{copy.money.base}</span>
          <Amount
            value={preview.distributableBase}
            className="text-ink-strong text-lg font-medium"
          />
        </div>
        <ApproveSettlementControl
          opportunityId={preview.opportunity.id}
          readyToApprove={readyToApprove}
          disabledReason={disabledReason}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.detail.ledger}</h2>
        <CashLedger events={preview.cashEvents} />
      </section>
    </div>
  );
}
