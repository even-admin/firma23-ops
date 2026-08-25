import { copy } from '@/copy/es-MX';
import { formatDate } from '@/lib/date';
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

/** The step marker's fill follows the same truthful status, never a generic progress guess. */
const STEP_TONE: Record<MilestoneStatus, string> = {
  pending: 'border-line bg-surface text-faint',
  in_progress: 'border-line-strong bg-surface text-ink',
  done: 'border-money/50 bg-money/10 text-money',
  blocked: 'border-attention/50 bg-attention/10 text-attention',
};

/**
 * One semantic milestone timeline: the ordered list itself carries the sequence, and a
 * connecting rail between step markers makes that order legible at a glance. The rail is
 * decorative (aria-hidden); every fact it echoes — position, status, dates, evidence —
 * already exists in the list's own text.
 */
export function MilestoneChecklist({ milestones }: MilestoneChecklistProps) {
  return (
    <ol className="flex flex-col">
      {milestones.map((milestone, index) => (
        <li key={milestone.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              aria-hidden="true"
              className={cn(
                'label-micro tnum flex size-7 shrink-0 items-center justify-center rounded-full border font-medium',
                STEP_TONE[milestone.status],
              )}
            >
              {String(milestone.position).padStart(2, '0')}
            </span>
            {index === milestones.length - 1 ? null : (
              <span aria-hidden="true" className="bg-line my-1 w-px flex-1" />
            )}
          </div>

          <div className="border-line bg-surface mb-3 flex min-w-0 flex-1 flex-col gap-2 rounded-md border p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
                  {copy.detail.dueAt} {formatDate(milestone.dueAt)}
                </span>
              )}
              {milestone.completedAt === null ? null : (
                <span>
                  {copy.detail.completedAt} {formatDate(milestone.completedAt)}
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
                      className="text-ink hover:text-ink-strong inline-flex min-h-11 items-center text-xs underline decoration-dotted underline-offset-4"
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
          </div>
        </li>
      ))}
    </ol>
  );
}
