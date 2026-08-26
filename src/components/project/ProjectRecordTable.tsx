import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
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
        className="project-record-table-shell border-line overflow-hidden rounded-lg border"
        data-record-view="table"
      >
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{copy.projects.title}</caption>
          <thead>
            <tr className="border-line bg-raised/45 border-b text-left">
              <th scope="col" className="label-micro text-faint w-[30%] px-3 py-2 font-medium">
                <span>{copy.projects.filterProject}</span>
              </th>
              <th scope="col" className="label-micro text-faint w-[13%] px-3 py-2 font-medium">
                <span>{copy.projects.filterStatus}</span>
              </th>
              <th
                scope="col"
                className="label-micro text-faint w-[12%] px-3 py-2 text-right font-medium"
              >
                <span>{copy.projects.services}</span>
              </th>
              <th
                scope="col"
                className="label-micro text-faint w-[15%] px-3 py-2 text-right font-medium"
              >
                <span>{copy.projects.opportunitiesCount}</span>
              </th>
              <th
                scope="col"
                className="label-micro text-faint w-[20%] px-3 py-2 text-right font-medium"
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
                <td className="min-w-0 px-3 py-4">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="text-ink hover:text-ink-strong flex min-h-11 flex-col justify-center underline-offset-4 hover:underline"
                  >
                    <span className="truncate text-sm font-medium">{project.name}</span>
                    <span className="text-faint block truncate text-xs">{project.sponsorName}</span>
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
            className="border-line bg-surface ease-firma hover:border-line-strong flex flex-col gap-5 rounded-lg border p-5 transition-colors sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
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

            <dl className="border-line grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-4">
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
              <div>
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
