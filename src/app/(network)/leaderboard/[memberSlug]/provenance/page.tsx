import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Amount } from '@/components/money/Amount';
import { RailStateBadge } from '@/components/revenue-rail/RailStateBadge';
import { EmptyState } from '@/components/state/EmptyState';
import { copy } from '@/copy/es-MX';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import { syntheticLeaderboardRepository } from '@/data/repositories/synthetic/leaderboard';

/**
 * Rail context 5 of 5: leaderboard provenance.
 *
 * Every centavo of a rank traces to one approved settlement line, with the
 * approver named. A leaderboard nobody can audit is just a claim.
 */
export default async function ProvenancePage({
  params,
}: {
  readonly params: Promise<{ readonly memberSlug: string }>;
}) {
  const { memberSlug } = await params;
  const viewer = await getPrototypeViewer();
  const provenance = await syntheticLeaderboardRepository.getProvenance(memberSlug, viewer);
  if (provenance === null) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-2">
        <p className="label-micro text-faint">{copy.leaderboard.provenanceTitle}</p>
        <h1 className="text-ink-strong text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
          {provenance.displayName}
        </h1>
        <p className="text-muted text-sm">{copy.leaderboard.provenanceSubtitle}</p>
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="label-micro text-faint">{copy.money.approved}</dt>
            <dd className="text-money text-xl font-medium">
              <Amount value={provenance.approvedEarnings} />
            </dd>
          </div>
          <div>
            <dt className="label-micro text-faint">{copy.money.paid}</dt>
            <dd className="text-ink text-xl font-medium">
              <Amount value={provenance.paidEarnings} />
            </dd>
          </div>
        </dl>
      </header>

      {provenance.entries.length === 0 ? (
        <EmptyState title={copy.leaderboard.noProvenance} />
      ) : (
        <ul className="flex flex-col gap-2">
          {provenance.entries.map((entry) => (
            <li
              key={entry.settlementId + entry.roleLabel}
              className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-4"
            >
              <span className="min-w-0 flex-1">
                <Link
                  href={`/opportunities/${entry.opportunityId}`}
                  className="text-ink hover:text-ink-strong flex min-h-11 items-center truncate text-sm underline-offset-4 hover:underline md:min-h-0"
                >
                  {entry.beneficiaryName}
                </Link>
                <span className="text-faint block truncate text-xs">
                  {entry.opportunityCode} · {entry.projectName} · {entry.roleLabel}
                </span>
                <span className="text-faint block truncate text-xs">
                  {copy.money.approvedBy} {entry.approvedByName} · {entry.approvedAt.slice(0, 10)}
                </span>
              </span>
              <Amount value={entry.amount} className="text-ink text-sm" />
              <RailStateBadge state={entry.payoutStatus === 'paid' ? 'paid' : 'approved'} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
