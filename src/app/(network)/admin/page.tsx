import { Suspense } from 'react';

import Link from 'next/link';

import { DocumentIntakePanel } from '@/components/admin/DocumentIntakePanel';
import { FinanceMetricCard } from '@/components/metrics/FinanceMetricCard';
import { Amount } from '@/components/money/Amount';
import { EmptyState } from '@/components/state/EmptyState';
import { PermissionDenied } from '@/components/state/PermissionDenied';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { activeOperationalFinanceRepository } from '@/data/repositories/active/operational-finance';
import { activeProjectRepository } from '@/data/repositories/active/projects';
import { activeMemberRepository } from '@/data/repositories/active/members';
import { isFounder } from '@/lib/viewer';

async function AdminBody() {
  const viewer = await getViewer();
  if (!isFounder(viewer)) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
        <h1 className="text-ink-strong mb-6 text-2xl font-medium tracking-tight">
          {copy.admin.title}
        </h1>
        <PermissionDenied detail={copy.viewer.warning} />
      </div>
    );
  }

  const [overview, projects, members] = await Promise.all([
    activeOperationalFinanceRepository.getOverview(viewer),
    activeProjectRepository.list(viewer),
    'listAssignmentMembers' in activeMemberRepository
      ? activeMemberRepository.listAssignmentMembers(viewer)
      : activeMemberRepository.listDirectory({}, viewer).then((rows) =>
          rows.map((row) => ({ memberId: row.memberId, displayName: row.displayName, role: row.role })),
        ),
  ]);

  const attention = overview.rows.filter((row) => row.rail.kind !== 'settlement');

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-3xl font-medium sm:text-4xl">
          {copy.admin.title}
        </h1>
        <p className="text-muted text-sm">{copy.admin.subtitle}</p>
      </header>

      <DocumentIntakePanel assignmentMembers={members} />

      <FinanceMetricCard totals={overview.totals} pendingApprovals={overview.pendingApprovals} />

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
                  className="text-ink hover:text-ink-strong flex min-h-11 items-center truncate text-sm underline-offset-4 hover:underline"
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
                  className="border-line-strong text-ink hover:bg-raised ease-firma flex min-h-11 items-center rounded-md border px-3 text-xs transition-colors duration-150"
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
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
      <LoadingBlock rows={4} />
    </div>
  );
}
