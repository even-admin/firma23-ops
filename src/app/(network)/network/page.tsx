import { Suspense } from 'react';

import { FilterChips, type FilterOption } from '@/components/filter/FilterChips';
import { OperatorCard } from '@/components/operator/OperatorCard';
import { EmptyState } from '@/components/state/EmptyState';
import { LoadingBlock } from '@/components/state/LoadingBlock';
import { copy } from '@/copy/es-MX';
import { getViewer } from '@/data/viewer-session';
import { syntheticMemberRepository } from '@/data/repositories/synthetic/members';
import type { Availability } from '@/types/domain';

interface DirectorySearchParams extends Readonly<Record<string, string | undefined>> {
  readonly availability?: string | undefined;
  readonly skill?: string | undefined;
}

const AVAILABILITIES: readonly Availability[] = ['open', 'limited', 'unavailable'];

async function NetworkBody({
  searchParams,
}: {
  readonly searchParams: Promise<DirectorySearchParams>;
}) {
  const query = await searchParams;
  const viewer = await getViewer();

  const all = await syntheticMemberRepository.listDirectory({}, viewer);
  const operators = await syntheticMemberRepository.listDirectory(
    { availability: query.availability, skillId: query.skill },
    viewer,
  );

  const availabilityOptions: FilterOption[] = [
    { value: null, label: copy.network.filterAll, count: all.length },
    ...AVAILABILITIES.map((availability) => ({
      value: availability,
      label: copy.network.availability[availability],
      count: all.filter((card) => card.availability === availability).length,
    })),
  ];

  // Skills offered as filters are the ones somebody actually holds.
  const skillCounts = new Map<string, { readonly name: string; count: number }>();
  for (const card of all) {
    for (const skill of card.skills) {
      const existing = skillCounts.get(skill.id);
      if (existing === undefined) skillCounts.set(skill.id, { name: skill.name, count: 1 });
      else existing.count += 1;
    }
  }
  const skillOptions: FilterOption[] = [
    { value: null, label: copy.network.filterAll },
    ...[...skillCounts.entries()]
      .filter(([, entry]) => entry.count > 1)
      .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name, 'es-MX'))
      .slice(0, 8)
      .map(([id, entry]) => ({ value: id, label: entry.name, count: entry.count })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-ink-strong text-3xl font-medium tracking-[-0.035em] sm:text-4xl">
          {copy.network.title}
        </h1>
        <p className="text-muted text-sm">{copy.network.subtitle}</p>
      </header>

      <div className="flex flex-col gap-3">
        <FilterChips
          legend={copy.network.filterAvailability}
          param="availability"
          options={availabilityOptions}
          active={query.availability ?? null}
          current={query}
          basePath="/network"
        />
        <FilterChips
          legend={copy.network.filterSkill}
          param="skill"
          options={skillOptions}
          active={query.skill ?? null}
          current={query}
          basePath="/network"
        />
      </div>

      {operators.length === 0 ? (
        <EmptyState title={copy.network.noMembers} />
      ) : (
        <ul className="grid min-w-0 gap-4 lg:grid-cols-2">
          {operators.map((operator) => (
            <li key={operator.memberId} className="min-w-0">
              <OperatorCard operator={operator} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/*
 * Loading UI lives in a Suspense boundary inside the page, not a segment-level
 * loading.tsx. A loading.tsx anywhere above a dynamic route flushes the stream
 * immediately, which locks the response status at 200 and makes notFound() serve
 * the not-found UI with a 200 instead of a 404.
 */
export default function NetworkPage(props: Parameters<typeof NetworkBody>[0]) {
  return (
    <Suspense fallback={<LoadingWrap />}>
      <NetworkBody {...props} />
    </Suspense>
  );
}

function LoadingWrap() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-10">
      <LoadingBlock rows={4} />
    </div>
  );
}
