import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/date';

import { Amount } from '@/components/money/Amount';
import { CashLedger } from '@/components/finance/CashLedger';
import { AssignmentList } from '@/components/opportunity/AssignmentList';
import { MilestoneChecklist } from '@/components/opportunity/MilestoneChecklist';
import { StatusPill } from '@/components/opportunity/StatusPill';
import { RailBaseExplainer } from '@/components/revenue-rail/RailBaseExplainer';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { activeOpportunityRepository } from '@/data/repositories/active/opportunities';
import { isFounder } from '@/lib/viewer';

export default async function OpportunityDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const viewer = await getViewer();

  if (!isFounder(viewer)) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 lg:px-10">
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight">{copy.board.title}</h1>
        <PermissionDenied detail={copy.viewer.warning} />
      </div>
    );
  }

  const detail = await activeOpportunityRepository.getById(opportunityId, viewer);
  if (detail === null) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-2">
        <p className="label-micro text-faint">
          <Link
            href={`/projects/${detail.summary.projectSlug}`}
            className="hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            {detail.summary.projectName}
          </Link>{' '}
          · {detail.summary.serviceName} v{detail.summary.serviceVersion}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h1 className="text-ink-strong text-3xl font-medium sm:text-4xl">
            {detail.summary.beneficiaryName}
          </h1>
          <StatusPill status={detail.summary.status} />
        </div>
        <p className="text-faint text-sm">
          {detail.summary.code} · {detail.summary.beneficiaryLocation} ·{' '}
          {formatDate(detail.summary.openedAt)}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <RailBaseExplainer
          base={detail.distributableBase}
          policyLabel={detail.basePolicyLabel}
          policyNote={detail.basePolicyNote}
          cashReceived={detail.cashReceived}
        />
        {/* Rail context 2 of 5: opportunity financial detail. */}
        <RevenueRail model={detail.rail} variant="detail" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.detail.assignments}</h2>
        <AssignmentList assignments={detail.assignments} pools={detail.pools} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="label-micro text-faint">{copy.detail.milestones}</h2>
          <span className="text-faint tnum text-xs">
            {detail.milestonesDone}/{detail.milestones.length}
          </span>
        </div>
        <MilestoneChecklist milestones={detail.milestones} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="label-micro text-faint">{copy.detail.ledger}</h2>
          <span className="text-faint text-xs">
            {copy.money.cashReceived}: <Amount value={detail.cashReceived} />
          </span>
        </div>
        <CashLedger events={detail.cashEvents} />
      </section>
    </div>
  );
}
