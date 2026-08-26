import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { ProjectCover } from '@/components/project/ProjectCover';
import { copy } from '@/copy/es-MX';
import type { ProjectSummary } from '@/types/views';

interface ProjectRecordTableProps {
  readonly projects: readonly ProjectSummary[];
}

/**
 * FIRMA23 responsive record grammar for Proyectos. Composition follows the
 * available content width rather than the viewport, because the transient
 * desktop rail can remove 200px from the page without changing the viewport.
 */
export function ProjectRecordTable({ projects }: ProjectRecordTableProps) {
  return (
    <div className="project-records" data-project-records>
      <div
        className="project-record-table-shell spatial-object border-line overflow-hidden border"
        data-record-view="table"
      >
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{copy.projects.title}</caption>
          <thead>
            <tr className="border-line bg-raised/45 border-b text-left">
              <th scope="col" className="label-micro text-faint w-[36%] px-3 py-2 font-medium">
                <span>{copy.projects.filterProject}</span>
              </th>
              <th scope="col" className="label-micro text-faint w-[12%] px-3 py-2 font-medium">
                <span>{copy.projects.filterStatus}</span>
              </th>
              <th
                scope="col"
                className="label-micro text-faint w-[10%] px-3 py-2 text-right font-medium"
              >
                <span>{copy.projects.services}</span>
              </th>
              <th
                scope="col"
                className="label-micro text-faint w-[13%] px-3 py-2 text-right font-medium"
              >
                <span>{copy.projects.opportunitiesCount}</span>
              </th>
              <th
                scope="col"
                className="label-micro text-faint w-[19%] px-3 py-2 text-right font-medium"
              >
                <span>{copy.projects.settledApproved}</span>
              </th>
              <th
                scope="col"
                className="label-micro text-faint w-[10%] px-3 py-2 text-right font-medium"
              >
                <span>{copy.projects.activeRule}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr
                key={project.id}
                className="border-line hover:bg-raised/20 border-b transition-colors last:border-b-0"
              >
                <td className="min-w-0 px-3 py-3">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="text-ink hover:text-ink-strong grid min-h-11 grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 underline-offset-4 hover:underline"
                  >
                    <ProjectCover projectId={project.id} size="thumbnail" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{project.name}</span>
                      <span className="text-faint block truncate text-xs">{project.sponsorName}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-4">
                  <span className="label-micro bg-raised/70 text-muted inline-flex rounded-sm px-2 py-1">
                    {copy.projects.statusLabels[project.status]}
                  </span>
                </td>
                <td className="text-ink tnum px-3 py-4 text-right text-sm">
                  {project.serviceCount}
                </td>
                <td className="text-ink tnum px-3 py-4 text-right text-sm">
                  {project.opportunityCount}
                </td>
                <td className="text-money px-3 py-4 text-right text-sm font-medium">
                  <Amount value={project.approvedSettled} />
                </td>
                <td className="text-faint tnum px-3 py-4 text-right text-xs">
                  {project.activeRule === null
                    ? '—'
                    : `${copy.projects.versionPrefix}${project.activeRule.version}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="project-record-list flex flex-col gap-3" data-record-view="list">
        {projects.map((project) => (
          <li
            key={project.id}
            className="spatial-object border-line bg-surface ease-firma hover:border-line-strong flex flex-col overflow-hidden border transition-colors"
          >
            <ProjectCover projectId={project.id} size="card" className="rounded-none border-0" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-5 pt-1 sm:px-6">
              <div className="min-w-0">
                <h2 className="text-ink-strong truncate text-lg font-medium">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                  >
                    {project.name}
                  </Link>
                </h2>
                <p className="text-faint text-sm">{project.sponsorName}</p>
              </div>
              <span className="label-micro bg-raised/70 text-muted rounded-sm px-2 py-1">
                {copy.projects.statusLabels[project.status]}
              </span>
            </div>

            <dl className="project-record-stats border-line mx-5 mb-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:mx-6 sm:mb-6">
              <div className="min-w-0">
                <dt className="label-micro text-faint">{copy.projects.services}</dt>
                <dd className="text-ink tnum text-sm">{project.serviceCount}</dd>
              </div>
              <div className="min-w-0">
                <dt className="label-micro text-faint">{copy.projects.opportunitiesCount}</dt>
                <dd className="text-ink tnum text-sm">{project.opportunityCount}</dd>
              </div>
              <div className="min-w-0">
                <dt className="label-micro text-faint">{copy.projects.settledApproved}</dt>
                <dd className="text-money text-sm font-medium">
                  <Amount value={project.approvedSettled} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="label-micro text-faint">{copy.projects.activeRule}</dt>
                <dd className="text-ink tnum text-sm">
                  {project.activeRule === null
                    ? copy.projects.noRule
                    : `${copy.projects.versionPrefix}${project.activeRule.version}`}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
