import { Amount } from '@/components/money/Amount';
import { copy } from '@/copy/es-MX';
import type { ProjectSummary } from '@/types/views';

interface ProjectHeaderProps {
  readonly project: ProjectSummary;
}

/** The exact project/client identity block. Every field comes straight off the view model. */
export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <p className="label-micro text-faint">{project.sponsorName}</p>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h1 className="text-ink-strong text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
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
  );
}
