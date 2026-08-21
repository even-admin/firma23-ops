import { copy } from '@/copy/es-MX';

export type NavKey = 'home' | 'opportunities' | 'network' | 'leaderboard' | 'admin';

export interface NavItem {
  readonly key: NavKey;
  readonly label: string;
  readonly href: string;
  /** Routes not yet built render disabled rather than linking to a 404. */
  readonly available: boolean;
  /** Founder-only destinations are marked so the rail can hide or disable them. */
  readonly founderOnly: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', label: copy.nav.home, href: '/', available: true, founderOnly: false },
  {
    key: 'opportunities',
    label: copy.nav.opportunities,
    href: '/opportunities',
    available: true,
    founderOnly: true,
  },
  {
    key: 'network',
    label: copy.nav.network,
    href: '/network',
    available: false,
    founderOnly: false,
  },
  {
    key: 'leaderboard',
    label: copy.nav.leaderboard,
    href: '/leaderboard',
    available: false,
    founderOnly: false,
  },
  { key: 'admin', label: copy.nav.admin, href: '/admin', available: false, founderOnly: true },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
