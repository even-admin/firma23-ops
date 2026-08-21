import { RailBaseExplainer } from '@/components/revenue-rail/RailBaseExplainer';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';

/**
 * Slice 1 surface.
 *
 * Deliberately not the product home. This page exists so the money contract and the
 * Revenue Rail can be reviewed side by side: the same SETY base, once projected and
 * once approved. The app shell, navigation, and real routes land in slice 2.
 */
export default async function SliceOnePage() {
  const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="label-micro text-faint">{copy.app.sliceBanner}</p>
        <h1 className="text-ink-strong text-3xl font-medium tracking-tight sm:text-4xl">
          {copy.app.name}
        </h1>
        <p className="text-muted max-w-2xl text-sm">{copy.app.sliceNote}</p>
      </header>

      <ul className="flex flex-col gap-6">
        {cards.map((card) => (
          <li
            key={card.opportunity.id}
            className="border-line bg-surface/40 flex flex-col gap-4 rounded-lg border p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <h2 className="text-ink-strong truncate text-lg font-medium">
                  {card.opportunity.beneficiaryName}
                </h2>
                <p className="text-faint text-sm">
                  {card.opportunity.code} · {card.opportunity.beneficiaryLocation} ·{' '}
                  {card.opportunity.projectName} · {card.opportunity.serviceName} v
                  {card.opportunity.serviceVersion}
                </p>
              </div>
              <span className="label-micro border-line-strong text-muted rounded-sm border px-2 py-0.5">
                {copy.opportunity.statusLabels[card.opportunity.status]}
              </span>
            </div>

            <RailBaseExplainer
              base={card.distributableBase.base}
              policyLabel={card.distributableBase.policyLabel}
              policyNote={card.distributableBase.policyNote}
              cashReceived={card.cashReceived}
            />

            <RevenueRail model={card.rail} variant="row" />
          </li>
        ))}
      </ul>
    </main>
  );
}
