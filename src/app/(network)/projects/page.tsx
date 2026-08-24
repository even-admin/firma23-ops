import { Suspense } from 'react';

import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticProjectRepository } from '@/data/repositories/synthetic/projects';
import { formatBasisPoints } from '@/lib/money';

async function ProjectsBody() {
  const viewer = await getPrototypeViewer();
  const projects = await syntheticProjectRepository.list(viewer);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
          {copy.projects.title}
        </h1>
        <p className="text-muted text-sm">{copy.projects.subtitle}</p>
      </header>

      {projects.length === 0 ? (
        <EmptyState title={copy.states.empty} />
      ) : (
        <ul className="flex flex-col gap-4">
          {projects.map((project) => (
            <li
              key={project.id}
              className="border-line bg-surface/40 flex flex-col gap-3 rounded-lg border p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h2 className="text-ink-strong truncate text-lg font-medium">
                    <Link
                      href={`/projects/${project.slug}`}
                      className="hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline md:min-h-0"
                    >
                      {project.name}
                    </Link>
                  </h2>
                  <p className="text-faint text-sm">{project.sponsorName}</p>
                </div>
                <span className="label-micro border-line-strong text-muted rounded-sm border px-2 py-0.5">
                  {copy.projects.statusLabels[project.status]}
                </span>
              </div>

              <dl className="flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <dt className="label-micro text-faint">{copy.projects.services}</dt>
                  <dd className="text-ink tnum text-sm">{project.serviceCount}</dd>
                </div>
                <div>
                  <dt className="label-micro text-faint">{copy.projects.opportunitiesCount}</dt>
                  <dd className="text-ink tnum text-sm">{project.opportunityCount}</dd>
                </div>
                <div>
                  <dt className="label-micro text-faint">{copy.projects.settledApproved}</dt>
                  <dd className="text-money text-sm font-medium">
                    <Amount value={project.approvedSettled} />
                  </dd>
                </div>
              </dl>

              {/* The rule is project data. Two projects here split money differently. */}
              {project.activeRule === null ? (
                <p className="text-faint text-xs">{copy.projects.noRule}</p>
              ) : (
                <p className="text-faint flex flex-wrap gap-x-3 text-xs">
                  <span className="label-micro">{copy.projects.activeRule}</span>
                  <span>
                    {copy.projects.versionPrefix}
                    {project.activeRule.version}
                  </span>
                  {project.activeRule.shares.map((share) => (
                    <span key={share.key} className="tnum">
                      {share.label} {formatBasisPoints(share.weightBp)}
                    </span>
                  ))}
                  <span>{project.activeRule.basePolicyLabel}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
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
export default function ProjectsPage() {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <ProjectsBody />
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
