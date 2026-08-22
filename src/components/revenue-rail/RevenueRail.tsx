import { Amount } from '@/components/money/Amount';
import { RailSegment } from '@/components/revenue-rail/RailSegment';
import { RailStateBadge } from '@/components/revenue-rail/RailStateBadge';
import { copy } from '@/copy/es-MX';
import type { RailModel } from '@/lib/allocation';
import { cn } from '@/lib/cn';

/**
 * The Revenue Rail.
 *
 * One component, five contexts: the board row, the opportunity financial detail,
 * the founder finance dashboard, the settlement approval preview, and leaderboard
 * provenance. Variants change density and which provenance is spelled out; they
 * never change what the rail is allowed to claim about the money.
 */
export type RevenueRailVariant = 'row' | 'detail' | 'dashboard' | 'approval' | 'provenance';

interface RevenueRailProps {
  readonly model: RailModel;
  readonly variant?: RevenueRailVariant;
  readonly className?: string;
}

/** Dense variants stack segments; roomy ones let them sit side by side. */
const SEGMENT_LAYOUT: Record<RevenueRailVariant, string> = {
  row: 'flex flex-col lg:flex-row lg:items-stretch',
  detail: 'flex flex-col lg:flex-row lg:items-stretch',
  dashboard: 'flex flex-col lg:flex-row lg:items-stretch',
  approval: 'flex flex-col lg:flex-row lg:items-stretch',
  provenance: 'flex flex-col',
};

export function RevenueRail({ model, variant = 'row', className }: RevenueRailProps) {
  const settled = model.kind === 'settlement';
  const showBase = variant === 'detail' || variant === 'approval' || variant === 'provenance';

  return (
    <section
      className={cn('flex flex-col gap-3', className)}
      data-variant={variant}
      data-rail-kind={model.kind}
      aria-label={settled ? copy.rail.settlementAria : copy.rail.projectionAria}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="label-micro text-ink-strong font-semibold">{copy.rail.label}</p>
        <RailStateBadge state={settled ? 'approved' : 'projected'} />
        <span className="text-faint text-xs">
          {copy.money.rulePrefix} v{model.ruleVersion}
        </span>
        {settled ? (
          <span className="text-faint text-xs">
            {copy.money.approvedBy} {model.approvedByDisplayName}
          </span>
        ) : (
          <span className="text-muted text-xs">{copy.money.notEarnedYet}</span>
        )}
        {showBase ? (
          <span className="text-faint text-xs">
            {copy.money.base}: <Amount value={model.base} />
          </span>
        ) : null}
        {settled && showBase ? (
          <span className="text-faint text-xs">{model.basePolicyLabel}</span>
        ) : null}
        {!settled && !model.fullyAssigned ? (
          <span className="text-attention text-xs">{copy.rail.incompleteAssignment}</span>
        ) : null}
      </header>

      <div aria-hidden="true" className="bg-line flex h-1 w-full overflow-hidden rounded-full">
        {model.segments.map((segment) => (
          <span
            key={segment.key}
            className={
              settled
                ? 'bg-money border-surface border-r last:border-r-0'
                : 'bg-line-strong border-bg border-r last:border-r-0'
            }
            style={{ flexGrow: segment.weightBp, flexBasis: 0 }}
          />
        ))}
      </div>

      <ul
        className={cn(
          SEGMENT_LAYOUT[variant],
          'overflow-hidden rounded-md border',
          settled ? 'border-money/40' : 'border-line-strong border-dashed',
        )}
      >
        {model.segments.map((segment) => (
          <RailSegment key={segment.key} segment={segment} settled={settled} />
        ))}
      </ul>

      {settled ? (
        <footer className="text-muted flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            {copy.money.paid}: <Amount value={model.paid} className="text-money" />
          </span>
          <span>
            {copy.money.unpaid}: <Amount value={model.unpaid} className="text-ink" />
          </span>
        </footer>
      ) : (
        <footer className="text-faint text-sm">{copy.money.projectedLong}</footer>
      )}
    </section>
  );
}
