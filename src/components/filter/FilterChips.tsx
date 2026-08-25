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
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="label-micro text-faint float-left mr-2 py-1">{legend}</legend>
      {options.map((option) => {
        const selected = option.value === active;
        return (
          <Link
            key={option.value ?? '__all__'}
            href={hrefFor(basePath, current, param, option.value)}
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'label-micro ease-firma flex min-h-11 items-center gap-1.5 rounded-sm border px-2.5 transition-colors duration-150',
              selected
                ? 'border-ink-950 bg-ink-950 text-paper-000'
                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {option.label}
            {option.count === undefined ? null : (
              <span className="text-faint tnum">{option.count}</span>
            )}
          </Link>
        );
      })}
    </fieldset>
  );
}
