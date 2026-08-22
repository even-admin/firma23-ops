import Link from 'next/link';

import { Amount } from '@/components/money/Amount';
import { AvailabilityBadge } from '@/components/operator/AvailabilityBadge';
import { SkillChips } from '@/components/operator/SkillChips';
import { StatGrid } from '@/components/operator/StatGrid';
import { copy } from '@/copy/es-MX';
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

  return (
    <article className="border-line bg-surface ease-firma hover:border-line-strong flex h-full min-w-0 flex-col gap-4 rounded-lg border p-4 transition-colors duration-150 sm:p-5">
      <header className="flex flex-wrap items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-ink-950 text-paper-000 label-micro flex size-11 shrink-0 items-center justify-center rounded-full font-medium"
        >
          {operator.initials}
        </span>
        <div className="min-w-0 flex-1">
          <Heading className="text-ink-strong truncate text-lg font-medium tracking-[-0.02em]">
            {linkToProfile ? (
              <Link
                href={`/network/${operator.slug}`}
                className="hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline md:min-h-0"
              >
                {operator.displayName}
              </Link>
            ) : (
              operator.displayName
            )}
          </Heading>
          <p className="text-faint text-xs">
            {operator.role === 'founder' ? copy.viewer.founder : copy.viewer.member} ·{' '}
            {copy.network.joined} {operator.joinedAt}
          </p>
        </div>
        <AvailabilityBadge availability={operator.availability} />
      </header>

      <p className="text-muted text-sm">{operator.bio}</p>

      <SkillChips skills={operator.skills} limit={5} />

      <StatGrid stats={operator.stats} />

      <footer className="border-line mt-auto grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-[auto_auto_1fr]">
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
