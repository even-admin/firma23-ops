import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Amount } from '@/components/money/Amount';
import { StatusPill } from '@/components/opportunity/StatusPill';
import { EmptyState } from '@/components/state/EmptyState';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticProjectRepository } from '@/data/repositories/synthetic/projects';
import { formatBasisPoints } from '@/lib/money';

export default async function ProjectDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const viewer = await getPrototypeViewer();
  const project = await syntheticProjectRepository.getBySlug(projectSlug, viewer);
  if (project === null) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <p className="label-micro text-faint">{project.sponsorName}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h1 className="text-ink-strong text-2xl font-medium tracking-tight sm:text-3xl">
            {project.name}
          </h1>
          <span className="label-micro border-line-strong text-muted rounded-sm border px-2 py-0.5">
            {copy.projects.statusLabels[project.status]}
          </span>
        </div>
        <p className="text-muted text-sm">
          {copy.projects.settledApproved}:{' '}
          <Amount value={project.approvedSettled} className="text-money" />
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.projects.services}</h2>
        {project.services.length === 0 ? (
          <EmptyState title={copy.projects.noServices} />
        ) : (
          <ul className="flex flex-col gap-2">
            {project.services.map((service) => (
              <li
                key={service.id}
                className="border-line bg-surface flex flex-col gap-1 rounded-md border p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-ink text-sm font-medium">{service.name}</span>
                  {/* Service versions referenced by an opportunity are frozen. */}
                  <span className="label-micro text-faint">
                    {copy.projects.versionPrefix}
                    {service.version}
                  </span>
                  <span className="text-faint tnum text-xs">
                    {service.milestoneCount} {copy.projects.milestones}
                  </span>
                </div>
                <p className="text-faint text-xs">{service.deliverablesSummary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.projects.rules}</h2>
        {project.rules.length === 0 ? (
          <EmptyState title={copy.projects.noRule} />
        ) : (
          <ul className="flex flex-col gap-2">
            {project.rules.map((rule) => (
              <li
                key={rule.id}
                className="border-line bg-surface flex flex-col gap-2 rounded-md border p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-ink text-sm font-medium">
                    {copy.projects.versionPrefix}
                    {rule.version}
                  </span>
                  <span className="text-faint text-xs">{rule.effectiveFrom}</span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {rule.shares.map((share) => (
                    <li
                      key={share.key}
                      className="border-line-strong text-muted label-micro tnum rounded-sm border px-2 py-0.5"
                    >
                      {share.label} {formatBasisPoints(share.weightBp)}
                    </li>
                  ))}
                </ul>
                <p className="text-faint text-xs">
                  <span className="text-ink">{rule.basePolicyLabel}.</span> {rule.basePolicyNote}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.projects.opportunitiesCount}</h2>
        {project.opportunities.length === 0 ? (
          <EmptyState title={copy.projects.noOpportunities} />
        ) : (
          <ul className="flex flex-col gap-2">
            {project.opportunities.map((opportunity) => (
              <li
                key={opportunity.id}
                className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-4"
              >
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/opportunities/${opportunity.id}`}
                    className="text-ink hover:text-ink-strong block truncate text-sm underline-offset-4 hover:underline"
                  >
                    {opportunity.beneficiaryName}
                  </Link>
                  <span className="text-faint block truncate text-xs">
                    {opportunity.code} · {opportunity.serviceName}
                  </span>
                </span>
                <StatusPill status={opportunity.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
