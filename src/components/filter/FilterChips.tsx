import Link from 'next/link';

import { cn } from '@/lib/cn';

export interface FilterOption {
  readonly value: string | null;
  readonly label: string;
  readonly count?: number | undefined;
}

interface FilterChipsProps {
  readonly legend: string;
  readonly param: string;
  readonly options: readonly FilterOption[];
  readonly active: string | null;
  /** Current query, so selecting one filter preserves the others. */
  readonly current: Readonly<Record<string, string | undefined>>;
  readonly basePath: string;
}

function hrefFor(
  basePath: string,
  current: Readonly<Record<string, string | undefined>>,
  param: string,
  value: string | null,
): string {
  const next = new URLSearchParams();
  for (const [key, existing] of Object.entries(current)) {
    if (existing !== undefined && key !== param) next.set(key, existing);
  }
  if (value !== null) next.set(param, value);
  const query = next.toString();
  return query === '' ? basePath : `${basePath}?${query}`;
}

/**
 * Filters as links, not client state.
 *
 * The filtered view is addressable, survives a reload, and needs no JavaScript,
 * which matters for an operator opening the same queue twenty times a day.
 */
export function FilterChips({
  legend,
  param,
  options,
  active,
  current,
  basePath,
}: FilterChipsProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="label-micro text-muted mb-2 block tracking-[0.12em] uppercase">
        {legend}
      </legend>
      <div className="border-line bg-surface no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--radius-control)] border p-1">
        {options.map((option) => {
          const selected = option.value === active;
          return (
            <Link
              key={option.value ?? '__all__'}
              href={hrefFor(basePath, current, param, option.value)}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'ease-firma text-muted focus-visible:outline-focus flex min-h-11 shrink-0 items-center gap-2 rounded-[8px] border px-3 text-xs font-medium tracking-[0.01em] transition-[background-color,border-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2',
                selected
                  ? 'border-ink-950 bg-ink-950 text-paper-000'
                  : 'border-transparent hover:border-line-strong hover:bg-black/5 hover:text-ink-strong',
              )}
            >
              {option.label}
              {option.count === undefined ? null : (
                <span
                  className={cn(
                    'tnum flex min-w-5 items-center justify-center rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] leading-none',
                    selected
                      ? 'border-paper-000/30 bg-paper-000/10 text-paper-000'
                      : 'border-line bg-black/5 text-muted',
                  )}
                >
                  {option.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </fieldset>
  );
}
