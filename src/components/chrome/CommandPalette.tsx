'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ChromeIcon, NavIcon } from '@/components/chrome/NavIcon';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import type { NavGroup, NavIconKey, NavLeaf } from '@/lib/nav';
import type { ViewerRole } from '@/lib/viewer';

interface Destination {
  readonly key: string;
  readonly icon: NavIconKey;
  readonly label: string;
  readonly href: string;
  readonly group: string;
}

function flatten(groups: readonly NavGroup[], role: ViewerRole): readonly Destination[] {
  const out: Destination[] = [];

  const reachable = (item: NavLeaf) => item.available && (!item.founderOnly || role === 'founder');

  for (const group of groups) {
    for (const item of group.items) {
      if (!reachable(item)) continue;
      out.push({
        key: item.key,
        icon: item.icon,
        label: item.label,
        href: item.href,
        group: group.heading,
      });
      for (const child of item.children ?? []) {
        if (!reachable(child)) continue;
        out.push({
          key: child.key,
          icon: child.icon,
          label: child.label,
          href: child.href,
          group: item.label,
        });
      }
    }
  }

  return out;
}

/** Accent-insensitive, so "ranking" finds "Ranking" and "merida" finds "Mérida". */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

interface CommandPaletteProps {
  readonly onClose: () => void;
  readonly groups: readonly NavGroup[];
  readonly role: ViewerRole;
  /**
   * Whatever had focus the instant before opening, captured by the caller.
   * Capturing it here instead would be too late: the caller also marks the
   * rest of the shell `inert` on this same open, and a browser blurs a
   * focused element the moment it becomes inert — by the time this
   * component's own effect ran, `document.activeElement` would already have
   * moved off the real opener.
   */
  readonly opener: HTMLElement | null;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Jump-to-destination over the navigation model only.
 *
 * It deliberately does not search opportunities or members: those live behind
 * repository calls the chrome has no business making, and a search box that
 * silently covers half the product is worse than one with a stated scope.
 *
 * Mounted only while open, so every opening starts from empty state without an
 * effect resetting anything.
 */
export function CommandPalette({ onClose, groups, role, opener }: CommandPaletteProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const destinations = useMemo(() => flatten(groups, role), [groups, role]);
  const results = useMemo(() => {
    const needle = fold(query.trim());
    if (needle === '') return destinations;
    return destinations.filter((item) => fold(`${item.group} ${item.label}`).includes(needle));
  }, [destinations, query]);

  // This component only ever mounts while open (see the class comment
  // above), so restoring focus in this mount effect's cleanup covers every
  // close path — Escape, backdrop, the close button, and selecting a
  // destination — without duplicating the restore call at each site.
  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      opener?.focus();
    };
  }, [opener]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      // A dialog with nothing rendered outside the app root has no natural
      // Tab boundary: without this, tabbing past the last result would
      // leave the document entirely (browser chrome) rather than cycling
      // back to the search input.
      const container = dialogRef.current;
      if (container === null) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => (results.length === 0 ? 0 : (value + 1) % results.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) =>
        results.length === 0 ? 0 : (value - 1 + results.length) % results.length,
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[cursor];
      if (target !== undefined) go(target.href);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label={copy.search.close}
        onClick={onClose}
        className="bg-ink-950/40 absolute inset-0 cursor-default backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.search.open}
        onKeyDown={onKeyDown}
        className="border-line-strong bg-surface relative w-full max-w-xl overflow-hidden rounded-lg border"
      >
        <div className="border-line flex items-center border-b px-4">
          <ChromeIcon name="search" className="text-faint mr-3 size-[18px] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder={copy.search.placeholder}
            aria-label={copy.search.placeholder}
            className="text-ink placeholder:text-faint focus-visible:outline-focus min-w-0 flex-1 rounded-sm bg-transparent py-4 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <kbd className="border-line-strong text-faint ml-2 hidden h-5 items-center justify-center rounded-[4px] border px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
            {copy.search.dismiss}
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.search.close}
            className="text-faint hover:bg-raised hover:text-ink ease-firma ml-1 flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150"
          >
            <ChromeIcon name="x" className="size-[18px]" />
          </button>
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8">
            <ChromeIcon name="command" className="text-faint size-6" />
            <p className="text-muted text-[13px] font-medium">{copy.search.empty}</p>
          </div>
        ) : (
          <ul className="no-scrollbar max-h-80 overflow-y-auto p-2">
            {results.map((item, index) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setCursor(index)}
                  aria-current={index === cursor ? 'true' : undefined}
                  className={cn(
                    'ease-firma flex min-h-11 w-full items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-left transition-colors duration-150',
                    index === cursor ? 'bg-raised text-ink-strong' : 'text-muted',
                  )}
                >
                  <NavIcon name={item.icon} />
                  <span className="truncate text-[13px] tracking-wide">{item.label}</span>
                  <span className="label-micro text-faint ml-auto shrink-0">{item.group}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
