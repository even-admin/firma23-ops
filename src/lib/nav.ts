import { copy } from '@/copy/es-MX';

export type NavKey = 'home' | 'opportunities' | 'network' | 'leaderboard' | 'admin';

/** Icon identity is a string here so this module stays free of React. */
export type NavIconKey = NavKey | 'projects' | 'finance' | 'child';

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
    available: true,
    founderOnly: false,
  },
  {
    key: 'leaderboard',
    label: copy.nav.leaderboard,
    href: '/leaderboard',
    available: true,
    founderOnly: false,
  },
  { key: 'admin', label: copy.nav.admin, href: '/admin', available: true, founderOnly: true },
];

/** Mobile has no nested project branch, so Projects is an explicit destination. */
export const MOBILE_NAV_ITEMS: readonly NavLeaf[] = [
  ...NAV_ITEMS.slice(0, 2).map(leafFromNavItem),
  {
    key: 'projects',
    icon: 'projects',
    label: copy.nav.projects,
    href: '/projects',
    available: true,
    founderOnly: false,
  },
  ...NAV_ITEMS.slice(2).map(leafFromNavItem),
];

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ---------------------------------------------------------------------------
// Sidebar model
// ---------------------------------------------------------------------------

/**
 * The sidebar, the top-bar breadcrumb, and the command palette all read this
 * shape, so a destination can only be added or gated in one place.
 */
export interface NavLeaf {
  readonly key: string;
  readonly icon: NavIconKey;
  readonly label: string;
  readonly href: string;
  readonly available: boolean;
  readonly founderOnly: boolean;
  /** Rendered as a count pill. Only ever a real figure; never a placeholder. */
  readonly badge?: number | undefined;
  /** Reveals a nested list. A branch is still a link to its own index. */
  readonly children?: readonly NavLeaf[];
}

export interface NavGroup {
  readonly key: string;
  readonly heading: string;
  readonly items: readonly NavLeaf[];
}

/** A project the viewer can reach, supplied by the route layer. */
export interface NavProjectLink {
  readonly slug: string;
  readonly name: string;
}

export interface NavModelInput {
  readonly projects: readonly NavProjectLink[];
  /** Settlements awaiting a founder. Undefined for viewers who cannot approve. */
  readonly pendingApprovals?: number | undefined;
}

function leafFromNavItem(item: NavItem): NavLeaf {
  return { ...item, icon: item.key };
}

export function buildNavGroups({ projects, pendingApprovals }: NavModelInput): readonly NavGroup[] {
  const byKey = new Map(NAV_ITEMS.map((item) => [item.key, item] as const));
  const operations: NavKey[] = ['home', 'opportunities', 'network', 'leaderboard'];

  const financeBadge =
    pendingApprovals !== undefined && pendingApprovals > 0 ? pendingApprovals : undefined;

  return [
    {
      key: 'workspace',
      heading: copy.nav.workspace,
      items: operations
        .map((key) => byKey.get(key))
        .filter((item): item is NavItem => item !== undefined)
        .map(leafFromNavItem),
    },
    {
      key: 'control',
      heading: copy.nav.control,
      items: [
        {
          key: 'projects',
          icon: 'projects',
          label: copy.nav.projects,
          href: '/projects',
          available: true,
          founderOnly: false,
          children: projects.map((project) => ({
            key: `project-${project.slug}`,
            icon: 'child' as const,
            label: project.name,
            href: `/projects/${project.slug}`,
            available: true,
            founderOnly: false,
          })),
        },
        {
          key: 'admin',
          icon: 'admin',
          label: copy.nav.admin,
          href: '/admin',
          available: true,
          founderOnly: true,
          // Finance lives at /admin/finance, so the rail nests it where the URL does.
          children: [
            {
              key: 'finance',
              icon: 'finance',
              label: copy.nav.finance,
              href: '/admin/finance',
              available: true,
              founderOnly: true,
              badge: financeBadge,
            },
          ],
        },
      ],
    },
  ];
}

/**
 * A branch is highlighted only on an exact match; a descendant route marks it as
 * *containing* the active item instead, which is what opens the nested list.
 *
 * Takes the children the viewer can actually reach, so a branch never opens for a
 * destination that was filtered out of it.
 */
export function containsActive(pathname: string, children: readonly NavLeaf[]): boolean {
  return children.some((child) => isActive(pathname, child.href));
}

export interface Breadcrumb {
  readonly group: string;
  readonly item: string;
}

/**
 * Group and destination for the top bar. Deliberately never derived from the raw
 * URL, so a breadcrumb can never surface a slug the interface has no label for.
 */
export function resolveBreadcrumb(
  pathname: string,
  groups: readonly NavGroup[],
): Breadcrumb | null {
  let fallback: Breadcrumb | null = null;

  for (const group of groups) {
    for (const item of group.items) {
      for (const child of item.children ?? []) {
        if (isActive(pathname, child.href)) return { group: item.label, item: child.label };
      }
      if (pathname === item.href) return { group: group.heading, item: item.label };
      if (isActive(pathname, item.href)) fallback = { group: group.heading, item: item.label };
    }
  }

  return fallback;
}
