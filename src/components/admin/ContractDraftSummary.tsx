import Link from 'next/link';

import { ConfidenceBadge } from '@/components/admin/ConfidenceBadge';
import { ConfirmContractControl } from '@/components/admin/ConfirmContractControl';
import { SourceDocumentCard } from '@/components/admin/SourceDocumentCard';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { ContractDraftView } from '@/types/views';

interface ContractDraftSummaryProps {
  readonly draft: ContractDraftView;
  /** Notifies a parent (e.g. the intake stepper) once confirmation actually
   * succeeds. Optional so existing callers/tests are unaffected. */
  readonly onConfirmed?: (() => void) | undefined;
}

const i = copy.admin.intake;

/**
 * The founder review boundary.
 *
 * Everything here is AI output: matched, extracted, or suggested, never
 * created. The confirm control at the bottom is disabled on purpose — M1 has
 * no path from a draft to a real contract, and a dead button is more honest
 * than one that quietly does nothing.
 */
export function ContractDraftSummary({ draft, onConfirmed }: ContractDraftSummaryProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-ink-strong text-lg font-medium">{i.draftTitle}</h3>
          {draft.confidenceOverall === null ? null : (
            <ConfidenceBadge confidence={draft.confidenceOverall} />
          )}
        </div>
        {draft.sourceDocumentName === null ? null : (
          <SourceDocumentCard
            fileName={draft.sourceDocumentName}
            kindLabel={draft.sourceDocumentKindLabel}
            extractedAt={draft.extractedAt}
            state="ready"
          />
        )}
        {draft.matchedProjectSlug === null ? (
          <p className="text-muted text-sm">{i.noMatchedProject}</p>
        ) : (
          <p className="text-ink text-sm">
            {i.matchedProject}{' '}
            <Link
              href={`/projects/${draft.matchedProjectSlug}`}
              className="text-ink-strong underline-offset-4 hover:underline"
            >
              {draft.matchedProjectName}
            </Link>
          </p>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <h4 className="label-micro text-faint">{i.fields}</h4>
        <ul className="flex flex-col gap-2">
          {draft.fields.map((field) => (
            <li
              key={field.label}
              className="border-line bg-surface flex flex-col gap-2 rounded-md border p-4"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="label-micro text-faint">{field.label}</span>
                <ConfidenceBadge confidence={field.confidence} />
              </div>
              <p className="text-ink text-sm">{field.value}</p>
              {field.evidence.length === 0 ? null : (
                <details>
                  <summary className="text-muted hover:text-ink flex min-h-11 cursor-pointer items-center text-xs underline decoration-dotted underline-offset-4">
                    {i.evidence}
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {field.evidence.map((evidence) => (
                      <li key={`${evidence.locationLabel}-${evidence.quote}`} className="text-faint text-xs">
                        <span className="text-muted">{evidence.locationLabel}:</span> “
                        {evidence.quote}”
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      {draft.services.length === 0 ? null : (
        <section className="flex flex-col gap-3">
          <h4 className="label-micro text-faint">{i.services}</h4>
          <ul className="flex flex-col gap-2">
            {draft.services.map((service) => (
              <li
                key={service.name}
                className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-4"
              >
                <span className="text-ink min-w-0 flex-1 truncate text-sm">{service.name}</span>
                <span className="text-faint text-xs">
                  {copy.projects.versionPrefix}
                  {service.version}
                </span>
                <span className="text-faint text-xs">
                  {service.milestoneCount} {copy.projects.milestones}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {draft.milestones.length === 0 ? null : (
        <section className="flex flex-col gap-3">
          <h4 className="label-micro text-faint">{i.milestones}</h4>
          <ol className="flex flex-col gap-2">
            {draft.milestones.map((milestone, index) => (
              <li
                key={`${milestone.serviceName}-${milestone.position}-${index}`}
                className="border-line bg-surface flex flex-col gap-1 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3">
                  <span className="label-micro text-faint tnum">
                    {String(milestone.position).padStart(2, '0')}
                  </span>
                  <span className="text-ink text-sm font-medium">{milestone.name}</span>
                  <span className="text-faint text-xs">{milestone.serviceName}</span>
                </div>
                <p className="text-faint text-xs">{milestone.description}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {draft.assignments.length === 0 ? null : (
        <section className="flex flex-col gap-3">
          <h4 className="label-micro text-faint">{i.assignments}</h4>
          <ul className="flex flex-col gap-2">
            {draft.assignments.map((assignment) => (
              <li
                key={assignment.roleLabel}
                className="border-line bg-surface flex flex-col gap-1 rounded-md border p-4"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-ink text-sm font-medium">{assignment.roleLabel}</span>
                  <span className="text-faint text-xs">
                    {assignment.shareOfBaseLabel} {i.shareOfBaseSuffix}
                  </span>
                  <ConfidenceBadge confidence={assignment.confidence} />
                </div>
                <p className="text-faint text-xs">{assignment.rationale}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {draft.projectedAllocation === null ? null : (
        <section className="flex flex-col gap-3">
          <h4 className="label-micro text-faint">{i.allocation}</h4>
          <RevenueRail model={draft.projectedAllocation} variant="detail" />
          {draft.projectedAllocationNote === null ? null : (
            <p className="text-faint text-xs">{draft.projectedAllocationNote}</p>
          )}
        </section>
      )}

      {draft.reviewIssues.length === 0 ? null : (
        <section className="flex flex-col gap-3">
          <h4 className="label-micro text-faint">{i.review}</h4>
          <ul className="flex flex-col gap-2">
            {draft.reviewIssues.map((issue) => (
              <li
                key={`${issue.severity}-${issue.fieldLabel}`}
                className="border-attention/40 bg-surface flex flex-col gap-1 rounded-md border p-4"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      'label-micro rounded-sm border px-2 py-0.5 font-medium',
                      issue.severity === 'missing'
                        ? 'border-attention text-attention'
                        : 'border-attention/50 text-attention',
                    )}
                  >
                    {issue.severity === 'missing' ? i.missing : i.ambiguous}
                  </span>
                  <span className="text-ink text-sm font-medium">{issue.fieldLabel}</span>
                </div>
                <p className="text-muted text-xs">{issue.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmContractControl
        draftId={draft.id}
        sponsorName={draft.sponsorName}
        programName={draft.programName}
        currency="MXN"
        matchedProjectSlug={draft.matchedProjectSlug}
        readyToConfirm
        onConfirmed={onConfirmed}
      />
    </div>
  );
}
