import type { ReactNode } from 'react';

import { ChromeShell } from '@/components/chrome/ChromeShell';
import { copy } from '@/copy/es-MX';
import type { NavGroup } from '@/lib/nav';
import type { ViewerRole } from '@/lib/viewer';

interface AppShellProps {
  readonly role: ViewerRole;
  readonly groups: readonly NavGroup[];
  /** Rendered inside the sidebar's organisation panel. Server-owned form action. */
  readonly viewerSwitcher: ReactNode;
  readonly children: ReactNode;
}

export function AppShell({ role, groups, viewerSwitcher, children }: AppShellProps) {
  return (
    <>
      {/* The rail is a long tab stop. Keyboard users get past it in one key. */}
      <a
        href="#main-content"
        className="border-line-strong bg-surface text-ink-strong sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:border focus:px-3 focus:py-2 focus:text-sm"
      >
        {copy.nav.skipToContent}
      </a>
      <ChromeShell role={role} groups={groups} viewerSwitcher={viewerSwitcher}>
        {children}
      </ChromeShell>
    </>
  );
}
