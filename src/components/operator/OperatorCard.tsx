import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { AvailabilityBadge } from '@/components/operator/AvailabilityBadge';
import { IdentityOrb } from '@/components/operator/IdentityOrb';
import { SkillChips } from '@/components/operator/SkillChips';
import { StatGrid } from '@/components/operator/StatGrid';
import { copy } from '@/copy/es-MX';
import { formatDate } from '@/lib/date';
import { cn } from '@/lib/cn';
import type { OperatorCardView } from '@/types/views';

interface OperatorCardProps {
  readonly operator: OperatorCardView;
  readonly linkToProfile?: boolean;
  /** h2 inside a directory list; h1 when the card is the subject of its page. */
  readonly headingLevel?: 'h1' | 'h2';
}

/**
 * The Operator Card.
 *
 * Not an avatar and a job title. Verified skills, derived performance, approved
 * earnings, availability, and the capability being built next, so real work reads
 * as a compounding reputation.
 *
 * Approved earnings only. A projection never appears on an identity surface.
 */
export function OperatorCard({
  operator,
  linkToProfile = true,
  headingLevel = 'h2',
}: OperatorCardProps) {
  const Heading = headingLevel;
  const isHero = headingLevel === 'h1';

  return (
    <article
      className={cn(
        'operator-card identity-orb-surface border-line bg-surface ease-firma hover:border-line-strong flex h-full min-w-0 flex-col rounded-lg border transition-colors duration-150',
        isHero ? 'gap-6 p-5 sm:p-7' : 'gap-5 p-5 sm:p-6',
      )}
    >
      <header className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <IdentityOrb memberId={operator.memberId} size={isHero ? 'hero' : 'card'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Heading
              className={cn(
                'text-ink-strong min-w-0 font-medium tracking-[-0.02em]',
                isHero ? 'text-3xl sm:text-4xl' : 'text-xl',
              )}
            >
              {linkToProfile ? (
                <Link
                  href={`/network/${operator.slug}`}
                  className="hover:text-ink inline-flex min-h-11 items-center break-words underline-offset-4 hover:underline"
                >
                  {operator.displayName}
                </Link>
              ) : (
                operator.displayName
              )}
            </Heading>
            {isHero ? (
              <span className="text-faint truncate font-mono text-xs">@{operator.slug}</span>
            ) : null}
          </div>
          <p className="text-faint text-xs">
            {operator.role === 'founder' ? copy.viewer.founder : copy.viewer.member} ·{' '}
            {copy.network.joined} {formatDate(operator.joinedAt)}
          </p>
        </div>
        <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start">
          <AvailabilityBadge availability={operator.availability} />
          {operator.activeWorkCount > 0 ? (
            <span className="label-micro text-faint">
              <span className="tnum text-muted">{operator.activeWorkCount}</span>{' '}
              {copy.network.activeWork}
            </span>
          ) : null}
        </div>
      </header>

      <p className="text-muted max-w-3xl text-sm leading-6">{operator.bio}</p>

      <SkillChips skills={operator.skills} limit={5} />

      <StatGrid stats={operator.stats} />

      <footer className="border-line mt-auto grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-[auto_auto_1fr]">
        <span>
          <span className="label-micro text-faint block">{copy.money.approved}</span>
          <Amount value={operator.approvedEarnings} className="text-money text-base font-medium" />
        </span>
        <span>
          <span className="label-micro text-faint block">{copy.money.paid}</span>
          <Amount value={operator.paidEarnings} className="text-ink text-base font-medium" />
        </span>
        <span className="col-span-2 sm:col-span-1 sm:ml-auto sm:text-right">
          <span className="label-micro text-faint block">{copy.network.nextCapability}</span>
          <span className="text-muted text-xs">{operator.nextCapability}</span>
        </span>
      </footer>
    </article>
  );
}
