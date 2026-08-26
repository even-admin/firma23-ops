import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StatusPill } from '@/components/opportunity/StatusPill';
import { ProjectHeader } from '@/components/project/ProjectHeader';
import { ProjectRuleHistory } from '@/components/project/ProjectRuleHistory';
import { EmptyState } from '@/components/state/EmptyState';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { activeProjectRepository } from '@/data/repositories/active/projects';

export default async function ProjectDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const viewer = await getViewer();
  const project = await activeProjectRepository.getBySlug(projectSlug, viewer);
  if (project === null) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <ProjectHeader project={project} />

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
                    className="text-ink hover:text-ink-strong flex min-h-11 items-center truncate text-sm underline-offset-4 hover:underline"
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

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.projects.rules}</h2>
        <ProjectRuleHistory
          activeRuleId={project.activeRule === null ? null : project.activeRule.id}
          rules={project.rules}
        />
      </section>
    </div>
  );
}
