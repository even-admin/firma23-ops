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

/** Fixed bottom bar so the primary destinations stay reachable with a thumb. */
export function MobileTabBar({ role }: MobileTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={copy.nav.mobile}
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-10 flex border-t md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const enabled = item.available && (!item.founderOnly || role === 'founder');
        const active = enabled && isActive(pathname, item.href);
        const classes = cn(
          'flex min-h-14 flex-1 flex-col items-center justify-center gap-1',
          !enabled && 'text-faint',
          enabled && !active && 'text-muted',
          enabled && active && 'text-ink-strong',
        );

        if (!enabled) {
          return (
            <span key={item.key} aria-disabled="true" className={classes}>
              <NavIcon name={item.key} />
              <span className="label-micro">{item.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={classes}
          >
            <NavIcon name={item.key} />
            <span className="label-micro">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
