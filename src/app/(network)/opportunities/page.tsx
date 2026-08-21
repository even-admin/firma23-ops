import { Suspense } from 'react';

import { FilterChips, type FilterOption } from '@/components/filter/FilterChips';
import { OpportunityRow } from '@/components/opportunity/OpportunityRow';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import { isFounder } from '@/lib/viewer';
import type { OpportunityStatus } from '@/types/domain';

/** Index signature so the value can be handed straight to FilterChips. */
interface BoardSearchParams extends Readonly<Record<string, string | undefined>> {
  readonly project?: string | undefined;
  readonly status?: string | undefined;
}

async function OpportunitiesBody({
  searchParams,
}: {
  readonly searchParams: Promise<BoardSearchParams>;
}) {
  const query = await searchParams;
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

  const all = await syntheticSettlementRepository.listOpportunityRails(viewer);

  // Counts come from the unfiltered set so a chip never reads zero for work that exists.
  const projectOptions: FilterOption[] = [
    { value: null, label: copy.board.filterAll, count: all.length },
    ...[
      ...new Map(all.map((card) => [card.opportunity.projectSlug, card.opportunity.projectName])),
    ].map(([slug, name]) => ({
      value: slug,
      label: name,
      count: all.filter((card) => card.opportunity.projectSlug === slug).length,
    })),
  ];

  const statusOptions: FilterOption[] = [
    { value: null, label: copy.board.filterAll, count: all.length },
    ...[...new Set(all.map((card) => card.opportunity.status))].map((status) => ({
      value: status,
      label: copy.opportunity.statusLabels[status],
      count: all.filter((card) => card.opportunity.status === status).length,
    })),
  ];

  const cards = all.filter(
    (card) =>
      (query.project === undefined || card.opportunity.projectSlug === query.project) &&
      (query.status === undefined ||
        card.opportunity.status === (query.status as OpportunityStatus)),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight sm:text-3xl">
          {copy.board.title}
        </h1>
        <p className="text-muted text-sm">{copy.board.subtitle}</p>
      </header>

      <div className="flex flex-col gap-3">
        <FilterChips
          legend={copy.board.filterProject}
          param="project"
          options={projectOptions}
          active={query.project ?? null}
          current={query}
          basePath="/opportunities"
        />
        <FilterChips
          legend={copy.board.filterStatus}
          param="status"
          options={statusOptions}
          active={query.status ?? null}
          current={query}
          basePath="/opportunities"
        />
      </div>

      {cards.length === 0 ? (
        <EmptyState title={copy.board.noMatches} detail={copy.states.empty} />
      ) : (
        <div className="flex flex-col gap-6">
          {cards.map((card) => (
            <OpportunityRow
              key={card.opportunity.id}
              id={card.opportunity.id}
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
export default function OpportunitiesPage(props: Parameters<typeof OpportunitiesBody>[0]) {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <OpportunitiesBody {...props} />
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
