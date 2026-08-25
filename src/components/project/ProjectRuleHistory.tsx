import { EmptyState } from '@/components/state/EmptyState';
import { copy } from '@/copy/es-MX';
import { formatBasisPoints } from '@/lib/money';
import type { ProjectRuleView } from '@/types/views';

interface ProjectRuleHistoryProps {
  readonly activeRuleId: string | null;
  readonly rules: readonly ProjectRuleView[];
}

/**
 * Every version a project has ever run under, newest first, with the one the
 * project currently uses tagged. The rule itself is project data — two projects
 * here can split the same base differently.
 */
export function ProjectRuleHistory({ activeRuleId, rules }: ProjectRuleHistoryProps) {
  if (rules.length === 0) {
    return <EmptyState title={copy.projects.noRule} />;
  }

  const ordered = [...rules].sort((a, b) => b.version - a.version);

  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((rule) => (
        <li
          key={rule.id}
          className="border-line bg-surface flex flex-col gap-2 rounded-md border p-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-ink text-sm font-medium">
              {copy.projects.versionPrefix}
              {rule.version}
            </span>
            {rule.id === activeRuleId ? (
              <span className="label-micro border-line-strong text-ink rounded-sm border px-2 py-0.5">
                {copy.projects.activeRule}
              </span>
            ) : null}
            <span className="text-faint text-xs">{rule.effectiveFrom}</span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {rule.shares.map((share) => (
              <li
                key={share.key}
                className="border-line-strong text-muted label-micro tnum rounded-sm border px-2 py-0.5"
              >
                {share.label} {formatBasisPoints(share.weightBp)}
              </li>
            ))}
          </ul>
          <p className="text-faint text-xs">
            <span className="text-ink">{rule.basePolicyLabel}.</span> {rule.basePolicyNote}
          </p>
        </li>
      ))}
    </ul>
  );
}
