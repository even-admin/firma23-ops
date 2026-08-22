'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavIcon } from '@/components/chrome/NavIcon';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import { isActive, NAV_ITEMS } from '@/lib/nav';
import type { ViewerRole } from '@/lib/viewer';

interface MobileTabBarProps {
  readonly role: ViewerRole;
}

/** Route-aware compact navigation adapted from the supplied expanding-pill pattern. */
export function MobileTabBar({ role }: MobileTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={copy.nav.mobile}
      className="border-rail-line-strong bg-rail on-rail fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex h-16 max-w-md items-center gap-1 rounded-full border p-1.5 md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const enabled = item.available && (!item.founderOnly || role === 'founder');
        const active = enabled && isActive(pathname, item.href);
        const classes = cn(
          'ease-firma relative flex min-h-12 min-w-11 items-center justify-center overflow-hidden rounded-full px-3 transition-[flex,color,background-color] duration-200',
          // A destination this viewer cannot open takes the least room, so the ones
          // they can open get the width instead.
          !enabled && 'text-rail-faint flex-none px-2',
          enabled && !active && 'text-rail-muted hover:bg-rail-hover hover:text-rail-ink flex-1',
          enabled && active && 'bg-rail-ink text-rail flex-[1.8]',
        );

        const content = (
          <>
            <NavIcon name={item.key} className="size-5" />
            <span
              className={cn(
                'ease-firma overflow-hidden text-xs font-medium whitespace-nowrap transition-[max-width,opacity,margin] duration-200',
                active ? 'ml-2 max-w-20 opacity-100' : 'ml-0 max-w-0 opacity-0',
              )}
            >
              {item.label}
            </span>
          </>
        );

        if (!enabled) {
          return (
            <span
              key={item.key}
              aria-disabled="true"
              aria-label={item.label}
              title={copy.states.permissionDenied}
              className={classes}
            >
              {content}
            </span>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            className={classes}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
