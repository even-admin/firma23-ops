import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/date';

import { AssignmentRow } from '@/components/operator/AssignmentRow';
import { OperatorCard } from '@/components/operator/OperatorCard';
import { SkillChips } from '@/components/operator/SkillChips';
import { EmptyState } from '@/components/state/EmptyState';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { syntheticMemberRepository } from '@/data/repositories/synthetic/members';
import { cn } from '@/lib/cn';

export default async function OperatorProfilePage({
  params,
}: {
  readonly params: Promise<{ readonly memberSlug: string }>;
}) {
  const { memberSlug } = await params;
  const viewer = await getViewer();
  const profile = await syntheticMemberRepository.getProfileBySlug(memberSlug, viewer);
  if (profile === null) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <OperatorCard operator={profile} linkToProfile={false} headingLevel="h1" />

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.network.skills}</h2>
        <SkillChips skills={profile.skills} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.network.portfolio}</h2>
        {profile.portfolio.length === 0 ? (
          <EmptyState title={copy.states.empty} />
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.portfolio.map((item) => (
              <li
                key={item.id}
                className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-4"
              >
                <span className="min-w-0 flex-1">
                  {/* Synthetic host. Nothing here resolves. */}
                  <a
                    href={item.url}
                    rel="noreferrer noopener"
                    className="text-ink hover:text-ink-strong flex min-h-11 items-center truncate text-sm underline decoration-dotted underline-offset-4"
                  >
                    {item.title}
                  </a>
                  <span className="text-faint block truncate text-xs">
                    {item.roleLabel} · {formatDate(item.completedAt)}
                  </span>
                </span>
                <span
                  className={cn(
                    'label-micro rounded-sm border px-2 py-0.5',
                    item.verification === 'verified'
                      ? 'border-line-strong text-ink'
                      : 'border-line text-faint border-dashed',
                  )}
                >
                  {item.verification === 'verified'
                    ? copy.network.verified
                    : copy.network.selfReported}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-micro text-faint">{copy.network.recentWork}</h2>
        {profile.recentWork.length === 0 ? (
          <EmptyState title={copy.home.noAssignments} />
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.recentWork.map((assignment) => (
              <AssignmentRow
                key={`${assignment.opportunityId}:${assignment.roleLabel}`}
                assignment={assignment}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
