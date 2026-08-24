import { cn } from '@/lib/cn';
import type { NavIconKey } from '@/lib/nav';

export type NavIconName = NavIconKey;
export type ChromeIconName =
  | NavIconName
  | 'chevron-down'
  | 'chevron-right'
  | 'command'
  | 'panel-left-close'
  | 'panel-left-open'
  | 'search'
  | 'x';

/**
 * One local stroke glyph set for the whole chrome.
 */
const PATHS: Record<ChromeIconName, readonly string[]> = {
  home: ['M4 5h16v14H4z', 'M4 10h16', 'M10 10v9'],
  opportunities: ['M5 8h14v10H5z', 'M9 8V6h6v2', 'M5 12h14'],
  network: ['M9.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M4 18a5.5 5.5 0 0 1 11 0', 'M16 10a2 2 0 1 0 0-4', 'M15.5 14.5A4.5 4.5 0 0 1 20 19'],
  leaderboard: ['M5 18V9', 'M12 18V5', 'M19 18v-6'],
  admin: ['M12 4 19 7v5c0 4-2.8 6.3-7 8-4.2-1.7-7-4-7-8V7z', 'm9 12 2 2 4-5'],
  projects: ['M4 7h6l2 2h8v9H4z', 'M4 9h16'],
  finance: ['M5 18h14', 'M7 16V9', 'M12 16V6', 'M17 16v-5', 'M4 9l8-5 8 5'],
  child: ['M7 8h10', 'M7 16h10', 'M10 5 8 19', 'M16 5l-2 14'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-right': ['m9 6 6 6-6 6'],
  command: ['M9 9h6v6H9z', 'M9 9H7a2 2 0 1 1 2-2v2Z', 'M15 9V7a2 2 0 1 1 2 2h-2Z', 'M15 15h2a2 2 0 1 1-2 2v-2Z', 'M9 15v2a2 2 0 1 1-2-2h2Z'],
  'panel-left-close': ['M4 5h16v14H4z', 'M9 5v14', 'm16 9-3 3 3 3'],
  'panel-left-open': ['M4 5h16v14H4z', 'M9 5v14', 'm13 9 3 3-3 3'],
  search: ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z', 'm15.5 15.5 4 4'],
  x: ['M6 6l12 12', 'M18 6 6 18'],
};

interface NavIconProps {
  readonly name: ChromeIconName;
  readonly className?: string;
  readonly strokeWidth?: number;
}

export function NavIcon({ name, className, strokeWidth = 1.5 }: NavIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
    >
      {PATHS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export const ChromeIcon = NavIcon;
