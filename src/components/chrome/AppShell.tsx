import type { ReactNode } from 'react';

import { MobileTabBar } from '@/components/chrome/MobileTabBar';
import { NavRail } from '@/components/chrome/NavRail';
import type { ViewerRole } from '@/lib/viewer';

interface AppShellProps {
  readonly role: ViewerRole;
  readonly topBar: ReactNode;
  readonly children: ReactNode;
}

export function AppShell({ role, topBar, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh">
      <NavRail role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-line bg-surface/60 flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
          {topBar}
        </div>
        {/* Bottom padding clears the fixed mobile tab bar. */}
        <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileTabBar role={role} />
    </div>
  );
}
