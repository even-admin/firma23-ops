import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import type { ProjectSummary } from '@/types/views';

interface ProjectRecordTableProps {
  readonly projects: readonly ProjectSummary[];
}

/**
 * FIRMA23 responsive record grammar for Proyectos: a semantic table at 768px and
 * above, and structured rows below it. Both renderings read the same
 * `ProjectSummary` fields; only the composition changes, so nothing is lost on
 * the narrow presentation.
 */
export function ProjectRecordTable({ projects }: ProjectRecordTableProps) {
  return (
    <>
      <table className="hidden w-full table-fixed border-collapse md:table">
        <caption className="sr-only">{copy.projects.title}</caption>
        <thead>
          <tr className="border-line border-b text-left">
            <th scope="col" className="label-micro text-faint w-[30%] px-3 py-2 font-medium">
              {copy.board.filterProject}
            </th>
            <th scope="col" className="label-micro text-faint w-[13%] px-3 py-2 font-medium">
              {copy.board.filterStatus}
            </th>
            <th
              scope="col"
              className="label-micro text-faint w-[12%] px-3 py-2 text-right font-medium"
            >
              {copy.projects.services}
            </th>
            <th
              scope="col"
              className="label-micro text-faint w-[15%] px-3 py-2 text-right font-medium"
            >
              {copy.projects.opportunitiesCount}
            </th>
            <th
              scope="col"
              className="label-micro text-faint w-[20%] px-3 py-2 text-right font-medium"
            >
              {copy.projects.settledApproved}
            </th>
            <th
              scope="col"
              className="label-micro text-faint w-[10%] px-3 py-2 text-right font-medium"
            >
              {copy.projects.activeRule}
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-line border-b last:border-b-0">
              <td className="min-w-0 px-3 py-3">
                <Link
                  href={`/projects/${project.slug}`}
                  className="text-ink hover:text-ink-strong flex min-h-11 flex-col justify-center underline-offset-4 hover:underline"
                >
                  <span className="truncate text-sm font-medium">{project.name}</span>
                  <span className="text-faint block truncate text-xs">{project.sponsorName}</span>
                </Link>
              </td>
              <td className="px-3 py-3">
                <span className="label-micro border-line-strong text-muted inline-flex rounded-sm border px-2 py-0.5">
                  {copy.projects.statusLabels[project.status]}
                </span>
              </td>
              <td className="text-ink tnum px-3 py-3 text-right text-sm">
                {project.serviceCount}
              </td>
              <td className="text-ink tnum px-3 py-3 text-right text-sm">
                {project.opportunityCount}
              </td>
              <td className="text-money px-3 py-3 text-right text-sm font-medium">
                <Amount value={project.approvedSettled} />
              </td>
              <td className="text-faint tnum px-3 py-3 text-right text-xs">
                {project.activeRule === null
                  ? '—'
                  : `${copy.projects.versionPrefix}${project.activeRule.version}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-4 md:hidden">
        {projects.map((project) => (
          <li
            key={project.id}
            className="border-line bg-surface/40 flex flex-col gap-3 rounded-lg border p-4"
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
    </>
  );
}
