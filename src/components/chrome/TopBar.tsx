'use client';

import { ChromeIcon } from '@/components/chrome/NavIcon';
import { copy } from '@/copy/es-MX';
import type { Breadcrumb } from '@/lib/nav';

interface TopBarProps {
  readonly sidebarOpen: boolean;
  readonly onToggleSidebar: () => void;
  readonly onOpenSearch: () => void;
  readonly breadcrumb: Breadcrumb | null;
}

/**
 * Where you are, and the control that gets the rail out of the way.
 *
 * The breadcrumb is the group and destination from the navigation model, never
 * the URL, so it cannot print a slug the interface has no label for. The page's
 * own h1 carries the record identity below it.
 */
export function TopBar({ sidebarOpen, onToggleSidebar, onOpenSearch, breadcrumb }: TopBarProps) {
  return (
    <div className="bg-bg sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-controls="firma23-sidebar"
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? copy.nav.hide : copy.nav.show}
          title={sidebarOpen ? copy.nav.hide : copy.nav.show}
          className="text-faint hover:bg-raised hover:text-ink ease-firma hidden size-11 items-center justify-center rounded-md border border-transparent transition-colors duration-150 md:flex"
        >
          <ChromeIcon
            name={sidebarOpen ? 'panel-left-close' : 'panel-left-open'}
            className="size-[18px]"
          />
        </button>

        <span className="text-ink-strong shrink-0 text-sm font-semibold tracking-[-0.055em] md:hidden">
          FIRMA23
        </span>

        {breadcrumb === null ? null : (
          <nav aria-label={copy.nav.breadcrumb} className="hidden min-w-0 items-center md:flex">
            <ol className="text-faint flex min-w-0 items-center gap-2 text-[13px]">
              <li className="truncate">{breadcrumb.group}</li>
              <li aria-hidden="true" className="text-line-strong">
                /
              </li>
              <li className="text-ink-strong truncate font-medium" aria-current="page">
                {breadcrumb.item}
              </li>
            </ol>
          </nav>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={copy.search.open}
        className="border-line text-faint hover:border-line-strong hover:bg-surface hover:text-muted ease-firma bg-bg flex h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-2.5 transition-colors duration-150 sm:w-64 sm:justify-start"
      >
        <ChromeIcon name="search" className="size-4 shrink-0" />
        <span className="hidden text-[13px] sm:inline">{copy.search.open}</span>
        <kbd className="border-line ml-auto hidden h-5 items-center justify-center rounded-[4px] border px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
          {copy.search.shortcut}
        </kbd>
      </button>
    </div>
  );
}
