import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import { formatBasisPoints } from '@/lib/money';
import type { ProgressionView } from '@/types/views';

interface ProgressionMeterProps {
  readonly progression: ProgressionView;
  readonly compact?: boolean;
  readonly tone?: 'paper' | 'glass';
}

/** Player-mode instrument. Outcome-derived XP never changes money or ranking. */
export function ProgressionMeter({
  progression,
  compact = false,
  tone = 'paper',
}: ProgressionMeterProps) {
  const remaining =
    progression.nextLevelXp === null ? 0 : Math.max(0, progression.nextLevelXp - progression.xp);
  const glass = tone === 'glass';

  return (
    <section
      className={cn(
        'progression-instrument min-w-0',
        glass ? 'progression-instrument--glass text-paper-000' : 'text-ink-strong',
        compact ? 'grid grid-cols-[auto_minmax(7rem,1fr)] items-center gap-3' : 'flex items-center gap-4',
      )}
      aria-label={copy.progression.title}
      data-player-mode="progression"
      data-progression-tone={tone}
    >
      <div
        className={cn(
          'progression-level-orb flex shrink-0 flex-col items-center justify-center rounded-full border text-center backdrop-blur-md',
          glass ? 'border-paper-000/45 bg-paper-000/12' : 'border-line-strong bg-raised/70',
          compact ? 'size-14' : 'size-16',
        )}
      >
        <span className={cn('label-micro', glass ? 'text-paper-100/70' : 'text-faint')}>
          {copy.progression.level}
        </span>
        <strong className="tnum font-mono text-lg leading-none font-medium">
          {String(progression.level).padStart(2, '0')}
        </strong>
      </div>

      <div className="min-w-0">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={cn('label-micro truncate', glass ? 'text-paper-100/70' : 'text-faint')}>
              {copy.progression.verifiedOutcomes}
            </p>
            <p className="tnum mt-0.5 font-mono text-sm font-medium">
              {progression.xp} {copy.progression.xp}
            </p>
          </div>
          <span className={cn('label-micro shrink-0', glass ? 'text-paper-100/55' : 'text-faint')}>
            v{progression.rulesetVersion}
          </span>
        </div>

        <div
          className={cn(
            'mt-2 h-1.5 overflow-hidden rounded-full border',
            glass ? 'border-paper-000/35 bg-ink-950/18' : 'border-line bg-raised',
          )}
          role="img"
          aria-label={`${progression.xp} ${copy.progression.xp}`}
        >
          <span
            aria-hidden="true"
            className={cn('block h-full', glass ? 'bg-paper-000/90' : 'bg-ink-950')}
            style={{ width: formatBasisPoints(progression.progressBp) }}
          />
        </div>

        <p className={cn('mt-2 text-xs', glass ? 'text-paper-100/70' : 'text-muted')}>
          {progression.nextLevelXp === null
            ? copy.progression.maxLevel
            : `${remaining} ${copy.progression.toNextLevel}`}
        </p>
      </div>
    </section>
  );
}
