import { Suspense } from 'react';

import { OpportunityRow } from '@/components/opportunity/OpportunityRow';
import { EmptyState } from '@/components/state/EmptyState';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import { isFounder } from '@/lib/viewer';

async function OpportunitiesBody() {
  const viewer = await getPrototypeViewer();

  // Full financial detail is founder-only. In M2 this is a Postgres policy, not a
  // branch; the branch exists so the denied state is reviewable now.
  if (!isFounder(viewer)) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight">{copy.board.title}</h1>
        <PermissionDenied detail={copy.viewer.warning} />
      </div>
    );
  }

  const cards = await syntheticSettlementRepository.listOpportunityRails(viewer);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight sm:text-3xl">
          {copy.board.title}
        </h1>
        <p className="text-muted text-sm">{copy.board.subtitle}</p>
      </header>

      {cards.length === 0 ? (
        <EmptyState title={copy.states.empty} />
      ) : (
        <div className="flex flex-col gap-6">
          {cards.map((card) => (
            <OpportunityRow
              key={card.opportunity.id}
              code={card.opportunity.code}
              beneficiaryName={card.opportunity.beneficiaryName}
              beneficiaryLocation={card.opportunity.beneficiaryLocation}
              projectName={card.opportunity.projectName}
              serviceName={card.opportunity.serviceName}
              serviceVersion={card.opportunity.serviceVersion}
              status={card.opportunity.status}
              rail={card.rail}
              base={card.distributableBase.base}
              basePolicyLabel={card.distributableBase.policyLabel}
              basePolicyNote={card.distributableBase.policyNote}
              cashReceived={card.cashReceived}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/*
 * Loading UI lives in a Suspense boundary inside the page, not a segment-level
 * loading.tsx. A loading.tsx anywhere above a dynamic route flushes the stream
 * immediately, which locks the response status at 200 and makes notFound() serve
 * the not-found UI with a 200 instead of a 404.
 */
export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <OpportunitiesBody />
    </Suspense>
  );
}

function LoadingWrap() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <LoadingBlock rows={4} />
    </div>
  );
}
