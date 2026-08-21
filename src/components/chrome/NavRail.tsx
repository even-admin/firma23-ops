'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavIcon } from '@/components/chrome/NavIcon';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import { isActive, NAV_ITEMS, type NavItem } from '@/lib/nav';
import type { ViewerRole } from '@/lib/viewer';

interface NavRailProps {
  readonly role: ViewerRole;
}

function itemClasses(active: boolean, enabled: boolean): string {
  return cn(
    'flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 transition-colors duration-150',
    'ease-firma',
    !enabled && 'text-faint cursor-not-allowed',
    enabled && !active && 'text-muted hover:bg-raised hover:text-ink',
    enabled && active && 'bg-raised text-ink-strong border-line-strong border',
  );
}

/** A route the viewer cannot reach yet, or is not permitted to reach. */
function enabledFor(item: NavItem, role: ViewerRole): boolean {
  if (!item.available) return false;
  if (item.founderOnly && role !== 'founder') return false;
  return true;
}

/** Compact rail, not a wide SaaS sidebar. Desktop only; mobile uses the tab bar. */
export function NavRail({ role }: NavRailProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={copy.nav.primary}
      className="border-line bg-surface hidden w-20 shrink-0 flex-col gap-1 border-r p-2 md:flex"
    >
      {NAV_ITEMS.map((item) => {
        const enabled = enabledFor(item, role);
        const active = enabled && isActive(pathname, item.href);

        if (!enabled) {
          return (
            <span
              key={item.key}
              aria-disabled="true"
              title={item.available ? copy.states.permissionDenied : copy.nav.soon}
              className={itemClasses(false, false)}
            >
              <NavIcon name={item.key} />
              <span className="label-micro text-center leading-tight">{item.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={itemClasses(active, true)}
          >
            <NavIcon name={item.key} />
            <span className="label-micro text-center leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
