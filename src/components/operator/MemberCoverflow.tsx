'use client';

import Link from 'next/link';
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

import { ChromeIcon } from '@/components/chrome/NavIcon';
import { Amount } from '@/components/money/Amount';
import { AvailabilityBadge } from '@/components/operator/AvailabilityBadge';
import { IdentityOrb } from '@/components/operator/IdentityOrb';
import { SkillChips } from '@/components/operator/SkillChips';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import { formatBasisPoints } from '@/lib/money';
import type { OperatorCardView } from '@/types/views';

interface MemberCoverflowProps {
  readonly operators: readonly OperatorCardView[];
}

interface CoverStyle extends CSSProperties {
  readonly '--cover-offset': number;
  readonly '--cover-distance': number;
}

function boundedOffset(index: number, active: number, total: number): number {
  let offset = index - active;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

function OutcomeSummary({ operator }: { readonly operator: OperatorCardView }) {
  const cells = [
    { label: copy.network.closed, value: String(operator.stats.closed) },
    { label: copy.network.delivered, value: String(operator.stats.delivered) },
    {
      label: copy.network.onTime,
      value:
        operator.stats.onTimeRateBp === null
          ? copy.network.noRate
          : formatBasisPoints(operator.stats.onTimeRateBp),
    },
  ] as const;

  return (
    <section className="border-line border-y py-4" aria-labelledby={`outcomes-${operator.memberId}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id={`outcomes-${operator.memberId}`} className="label-micro text-faint">
          {copy.network.verifiedOutcomes}
        </h3>
        {operator.activeWorkCount > 0 ? (
          <span className="text-muted tnum text-xs">
            {operator.activeWorkCount} {copy.network.activeWork}
          </span>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <dd className="text-ink-strong tnum text-xl font-medium">{cell.value}</dd>
            <dt className="text-faint mt-1 truncate text-[11px]">{cell.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function InactiveMemberCover({ operator }: { readonly operator: OperatorCardView }) {
  return (
    <article className="spatial-object border-line bg-surface flex h-full min-w-0 flex-col overflow-hidden border p-6">
      <div className="identity-orb-surface flex flex-1 flex-col items-center justify-center text-center">
        <IdentityOrb memberId={operator.memberId} size="hero" />
        <p className="text-ink-strong mt-5 max-w-[14rem] text-2xl leading-tight font-medium">
          {operator.displayName}
        </p>
        <p className="text-faint mt-2 text-xs">
          {operator.role === 'founder' ? copy.viewer.founder : copy.viewer.member}
        </p>
      </div>
      <div className="border-line border-t pt-4">
        <p className="label-micro text-faint">{copy.network.nextCapability}</p>
        <p className="text-muted mt-1 line-clamp-2 text-sm">{operator.nextCapability}</p>
      </div>
    </article>
  );
}

function ActiveMemberCover({ operator }: { readonly operator: OperatorCardView }) {
  return (
    <article
      className="identity-orb-surface spatial-object border-line/70 bg-surface flex h-full min-w-0 flex-col overflow-hidden border p-5 sm:p-6"
      data-mobile-nav-clearance
    >
      <header className="flex min-w-0 items-start gap-4">
        <div className="member-portrait-slot flex size-14 shrink-0 items-center justify-center rounded-full border border-line backdrop-blur-md">
          <IdentityOrb memberId={operator.memberId} size="card" className="size-10" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-faint text-xs">
            {operator.role === 'founder' ? copy.viewer.founder : copy.viewer.member}
          </p>
          <h2 className="text-ink-strong mt-0.5 text-2xl leading-tight font-medium">
            <Link
              href={`/network/${operator.slug}`}
              className="inline-flex min-h-11 items-center break-words underline-offset-4 hover:underline"
            >
              {operator.displayName}
            </Link>
          </h2>
        </div>
        <AvailabilityBadge availability={operator.availability} />
      </header>

      <p className="text-muted mt-4 line-clamp-2 min-h-12 text-sm leading-6">{operator.bio}</p>

      <div className="mt-4">
        <SkillChips skills={operator.skills} limit={3} />
      </div>

      <div className="mt-5">
        <OutcomeSummary operator={operator} />
      </div>

      <footer className="border-line mt-auto grid grid-cols-[auto_minmax(0,1fr)] gap-6 border-t pt-4">
        <div>
          <p className="label-micro text-faint">{copy.money.approved}</p>
          <Amount value={operator.approvedEarnings} className="text-money mt-1 text-base font-medium" />
        </div>
        <div className="min-w-0 text-right">
          <p className="label-micro text-faint">{copy.network.nextCapability}</p>
          <p className="text-muted mt-1 truncate text-sm">{operator.nextCapability}</p>
        </div>
      </footer>
    </article>
  );
}

function MemberCover({ operator, selected }: { readonly operator: OperatorCardView; readonly selected: boolean }) {
  return selected ? <ActiveMemberCover operator={operator} /> : <InactiveMemberCover operator={operator} />;
}

/** Repository-backed member coverflow; mobile displays one stable card at a time. */
export function MemberCoverflow({ operators }: MemberCoverflowProps) {
  const [active, setActive] = useState(0);
  const pointerStart = useRef<number | null>(null);

  if (operators.length === 0) return null;

  const activeIndex = Math.min(active, operators.length - 1);
  const move = (direction: -1 | 1) => {
    setActive((activeIndex + direction + operators.length) % operators.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActive(operators.length - 1);
    }
  };

  return (
    <section aria-labelledby="network-coverflow-title" className="min-w-0">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="label-micro text-faint">{copy.network.roster}</p>
          <h2 id="network-coverflow-title" className="text-ink-strong mt-1 text-xl font-medium">
            {copy.network.directoryTitle}
          </h2>
        </div>
        <p className="label-micro text-faint tnum" aria-live="polite" aria-atomic="true">
          {String(activeIndex + 1).padStart(2, '0')} / {String(operators.length).padStart(2, '0')}
        </p>
      </div>

      <div
        className="member-coverflow relative min-h-[36rem] touch-pan-y overflow-hidden border-y border-line py-5 focus:outline-none sm:min-h-[38rem]"
        role="group"
        aria-roledescription="carrusel"
        aria-label={copy.network.carouselLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          pointerStart.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const start = pointerStart.current;
          pointerStart.current = null;
          if (start === null) return;
          const delta = event.clientX - start;
          if (Math.abs(delta) >= 48) move(delta > 0 ? -1 : 1);
        }}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        {operators.map((operator, index) => {
          const offset = boundedOffset(index, activeIndex, operators.length);
          const distance = Math.abs(offset);
          const selected = index === activeIndex;

          return (
            <div
              key={operator.memberId}
              className={cn(
                'member-cover absolute top-5 left-1/2 h-[33.5rem] w-[min(84vw,28rem)] sm:h-[35.5rem]',
                distance > 2 && 'invisible',
              )}
              style={
                {
                  '--cover-offset': offset,
                  '--cover-distance': distance,
                  zIndex: operators.length - distance,
                } as CoverStyle
              }
              aria-hidden={!selected}
              inert={!selected}
            >
              <MemberCover operator={operator} selected={selected} />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => move(-1)}
          className="glass-orb-button flex size-12 items-center justify-center rounded-full"
          aria-label={copy.network.previousMember}
        >
          <ChromeIcon name="chevron-right" className="rotate-180" />
        </button>

        <div className="glass-pagination no-scrollbar flex max-w-[min(60vw,24rem)] items-center justify-center gap-1 overflow-x-auto rounded-full border border-line px-2 backdrop-blur-md">
          {operators.map((operator, index) => (
            <button
              key={operator.memberId}
              type="button"
              onClick={() => setActive(index)}
              className="group flex size-11 shrink-0 items-center justify-center rounded-full"
              aria-label={`${copy.network.showMember}: ${operator.displayName}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block rounded-full transition-[width,background-color] duration-200',
                  index === activeIndex ? 'bg-ink-950 h-1.5 w-6' : 'bg-line-strong size-1.5 group-hover:bg-ink',
                )}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => move(1)}
          className="glass-orb-button flex size-12 items-center justify-center rounded-full"
          aria-label={copy.network.nextMember}
        >
          <ChromeIcon name="chevron-right" />
        </button>
      </div>
    </section>
  );
}
