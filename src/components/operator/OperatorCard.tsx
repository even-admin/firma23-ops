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
export function OperatorCard({ operator, linkToProfile = true }: OperatorCardProps) {
  return (
    <article className="border-line bg-surface/40 flex flex-col gap-4 rounded-lg border p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="border-line-strong text-muted label-micro flex size-10 shrink-0 items-center justify-center rounded-full border font-medium"
        >
          {operator.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-ink-strong truncate text-base font-medium">
            {linkToProfile ? (
              <Link
                href={`/network/${operator.slug}`}
                className="hover:text-ink underline-offset-4 hover:underline"
              >
                {operator.displayName}
              </Link>
            ) : (
              operator.displayName
            )}
          </h3>
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

      <footer className="border-line flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t pt-3">
        <span>
          <span className="label-micro text-faint block">{copy.money.approved}</span>
          <Amount value={operator.approvedEarnings} className="text-money text-base font-medium" />
        </span>
        <span>
          <span className="label-micro text-faint block">{copy.money.paid}</span>
          <Amount value={operator.paidEarnings} className="text-ink text-base font-medium" />
        </span>
        <span className="ml-auto">
          <span className="label-micro text-faint block">{copy.network.nextCapability}</span>
          <span className="text-muted text-xs">{operator.nextCapability}</span>
        </span>
      </footer>
    </article>
  );
}
