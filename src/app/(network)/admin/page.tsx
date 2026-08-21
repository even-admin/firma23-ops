import { Suspense } from 'react';

import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { EmptyState } from '@/components/state/EmptyState';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticFinanceRepository } from '@/data/repositories/synthetic/finance';
import { syntheticProjectRepository } from '@/data/repositories/synthetic/projects';
import { isFounder } from '@/lib/viewer';

async function AdminBody() {
  const viewer = await getPrototypeViewer();
  if (!isFounder(viewer)) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-ink-strong mb-6 text-2xl font-medium tracking-tight">
          {copy.admin.title}
        </h1>
        <PermissionDenied detail={copy.viewer.warning} />
      </div>
    );
  }

  const [overview, projects] = await Promise.all([
    syntheticFinanceRepository.getOverview(viewer),
    syntheticProjectRepository.list(viewer),
  ]);

  const attention = overview.rows.filter((row) => row.rail.kind === 'projection');

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-2xl font-medium tracking-tight sm:text-3xl">
          {copy.admin.title}
        </h1>
        <p className="text-muted text-sm">{copy.admin.subtitle}</p>
      </header>

      <section className="border-line bg-surface flex flex-wrap gap-x-10 gap-y-4 rounded-lg border p-4 sm:p-6">
        <div>
          <p className="label-micro text-faint">{copy.finance.cashReceived}</p>
          <p className="text-ink-strong mt-1 text-2xl font-medium">
            <Amount value={overview.totals.cashReceived} />
          </p>
        </div>
        <div>
          <p className="label-micro text-faint">{copy.finance.approvedBase}</p>
          <p className="text-money mt-1 text-2xl font-medium">
            <Amount value={overview.totals.distributableApproved} />
          </p>
        </div>
        <div>
          <p className="label-micro text-faint">{copy.finance.owed}</p>
          <p className="text-ink mt-1 text-2xl font-medium">
            <Amount value={overview.totals.owed} />
          </p>
        </div>
        <div>
          <p className="label-micro text-faint">{copy.finance.pendingApprovals}</p>
          <p className="text-attention tnum mt-1 text-2xl font-medium">
            {overview.pendingApprovals}
          </p>
        </div>
        <Link
          href="/admin/finance"
          className="border-line-strong text-ink-strong hover:bg-raised ease-firma ml-auto flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150"
        >
          {copy.finance.title}
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.admin.portfolio}</h2>
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-4"
            >
              <span className="min-w-0 flex-1">
                <Link
                  href={`/projects/${project.slug}`}
                  className="text-ink hover:text-ink-strong block truncate text-sm underline-offset-4 hover:underline"
                >
                  {project.name}
                </Link>
                <span className="text-faint block truncate text-xs">
                  {copy.projects.statusLabels[project.status]} · {project.opportunityCount}{' '}
                  {copy.projects.opportunitiesCount.toLowerCase()}
                </span>
              </span>
              <Amount value={project.approvedSettled} className="text-money text-sm" />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.admin.attention}</h2>
        {attention.length === 0 ? (
          <EmptyState title={copy.admin.nothingPending} />
        ) : (
          <ul className="flex flex-col gap-2">
            {attention.map((row) => (
              <li
                key={row.opportunity.id}
                className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-sm">
                    {row.opportunity.beneficiaryName}
                  </span>
                  <span className="text-faint block truncate text-xs">
                    {row.opportunity.code} · {row.opportunity.projectName}
                  </span>
                </span>
                <Link
                  href={`/admin/finance/${row.opportunity.id}/settle`}
                  className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-9 items-center rounded-md border px-3 text-xs transition-colors duration-150"
                >
                  {copy.finance.review}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/*
 * Loading UI lives in a Suspense boundary inside the page, not a segment-level
 * loading.tsx. A loading.tsx anywhere above a dynamic route flushes the stream
 * immediately, which locks the response status at 200 and makes notFound() serve
 * the not-found UI with a 200 instead of a 404.
 */
export default function AdminPage() {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <AdminBody />
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
