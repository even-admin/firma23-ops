import type { NavKey } from '@/lib/nav';

/**
 * Hand-authored 20px stroke icons.
 *
 * An icon library would be a dependency and a bundle for five glyphs, and none of
 * them would match the restrained line weight this interface uses.
 */
const PATHS: Record<NavKey, string> = {
  home: 'M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V8.5Z',
  opportunities:
    'M3 7h14v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Zm4 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 11h14',
  network:
    'M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 17v-1.5A3.5 3.5 0 0 1 6 12h2a3.5 3.5 0 0 1 3.5 3.5V17m3-5h.5a3 3 0 0 1 3 3V17',
  leaderboard: 'M4 17V9m6 8V4m6 13v-6M2 17h16',
  admin: 'M10 3l6 2.5V10c0 3.5-2.4 6-6 7-3.6-1-6-3.5-6-7V5.5L10 3Zm0 5v4',
};

interface NavIconProps {
  readonly name: NavKey;
}

export function NavIcon({ name }: NavIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
