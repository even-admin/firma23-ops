import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { MilestoneStatus } from '@/types/domain';
import type { MilestoneView } from '@/types/views';

interface MilestoneChecklistProps {
  readonly milestones: readonly MilestoneView[];
}

const STATUS_TONE: Record<MilestoneStatus, string> = {
  pending: 'border-line text-faint',
  in_progress: 'border-line-strong text-ink',
  done: 'border-money/50 text-money',
  blocked: 'border-attention/50 text-attention',
};

export function MilestoneChecklist({ milestones }: MilestoneChecklistProps) {
  return (
    <ol className="flex flex-col gap-2">
      {milestones.map((milestone) => (
        <li
          key={milestone.id}
          className="border-line bg-surface flex flex-col gap-2 rounded-md border p-4"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="label-micro text-faint tnum">
              {String(milestone.position).padStart(2, '0')}
            </span>
            <span className="text-ink min-w-0 flex-1 truncate text-sm font-medium">
              {milestone.name}
            </span>
            {milestone.assignedMemberInitials === null ? null : (
              <span
                title={milestone.assignedMemberName ?? undefined}
                className="border-line-strong text-muted label-micro flex size-6 items-center justify-center rounded-full border"
              >
                {milestone.assignedMemberInitials}
              </span>
            )}
            <span
              className={cn(
                'label-micro rounded-sm border px-2 py-0.5 font-medium',
                STATUS_TONE[milestone.status],
              )}
            >
              {copy.detail.milestoneStatus[milestone.status]}
            </span>
          </div>

          <p className="text-faint text-xs">{milestone.description}</p>

          <div className="text-faint flex flex-wrap gap-x-4 text-xs">
            {milestone.dueAt === null ? null : (
              <span>
                {copy.detail.dueAt} {milestone.dueAt}
              </span>
            )}
            {milestone.completedAt === null ? null : (
              <span>
                {copy.detail.completedAt} {milestone.completedAt}
              </span>
            )}
          </div>

          {milestone.evidence.length === 0 ? null : (
            <ul className="flex flex-col gap-1">
              {milestone.evidence.map((evidence) => (
                <li key={evidence.id} className="flex flex-wrap items-baseline gap-x-2">
                  {/* Synthetic hosts only. Nothing here resolves. */}
                  <a
                    href={evidence.url}
                    rel="noreferrer noopener"
                    className="text-ink hover:text-ink-strong text-xs underline decoration-dotted underline-offset-4"
                  >
                    {evidence.label}
                  </a>
                  <span className="text-faint text-xs">
                    {evidence.submittedByName} · {evidence.submittedAt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
