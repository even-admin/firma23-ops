'use client';

import { useSyncExternalStore } from 'react';

import { MeshDriftCanvas } from '@/components/visual/MeshDriftCanvas';
import { copy } from '@/copy/es-MX';

interface PersonalIdentityFieldProps {
  readonly displayName: string;
  readonly activeWorkCount: number;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Merida',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Merida',
});

function subscribeToClock(onStoreChange: () => void): () => void {
  const interval = window.setInterval(onStoreChange, 30_000);
  return () => window.clearInterval(interval);
}

function getClockSnapshot(): number {
  return Math.floor(Date.now() / 30_000);
}

function getServerClockSnapshot(): null {
  return null;
}

export function PersonalIdentityField({ displayName, activeWorkCount }: PersonalIdentityFieldProps) {
  const clock = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);
  const now = clock === null ? null : new Date(clock * 30_000);
  const activeLabel =
    activeWorkCount === 1
      ? copy.home.commandStrip.activeOperation
      : copy.home.commandStrip.activeOperations;

  return (
    <section
      className="studio-focus on-rail relative min-h-64 overflow-hidden sm:min-h-72"
      aria-labelledby="personal-command-name"
    >
      <MeshDriftCanvas />
      <div className="absolute inset-0 bg-ink-950/10" aria-hidden="true" />
      <div className="absolute inset-0 z-10 flex min-h-64 flex-col justify-between p-6 text-paper-000 sm:min-h-72 sm:p-7">
        <div>
          <p className="font-mono text-xs text-paper-000/72">
            {copy.home.commandStrip.identityCode}
          </p>
          <h1
            id="personal-command-name"
            className="mt-4 max-w-sm text-3xl leading-[1.06] font-medium text-pretty sm:text-4xl"
          >
            {displayName}
          </h1>
        </div>

        <div className="flex items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="min-h-5 first-letter:uppercase text-sm text-paper-000/88">
              {now === null ? null : DATE_FORMATTER.format(now)}
            </p>
            <p className="tnum mt-1 min-h-7 font-mono text-lg font-medium">
              {now === null ? null : `${TIME_FORMATTER.format(now)} ${copy.home.commandStrip.timeZone}`}
            </p>
          </div>
          {activeWorkCount > 0 ? (
            <p className="max-w-28 text-right text-xs leading-5 text-paper-000/76">
              <span className="tnum block font-mono text-lg font-medium text-paper-000">
                {activeWorkCount}
              </span>
              {activeLabel}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
