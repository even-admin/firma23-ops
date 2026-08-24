'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { CommandPalette } from '@/components/chrome/CommandPalette';
import { MobileTabBar } from '@/components/chrome/MobileTabBar';
import { Sidebar } from '@/components/chrome/Sidebar';
import { TopBar } from '@/components/chrome/TopBar';
import { cn } from '@/lib/cn';
import { resolveBreadcrumb, type NavGroup } from '@/lib/nav';
import type { ViewerRole } from '@/lib/viewer';

interface ChromeShellProps {
  readonly role: ViewerRole;
  readonly groups: readonly NavGroup[];
  readonly viewerSwitcher: ReactNode;
  readonly children: ReactNode;
}

/**
 * Holds the two pieces of chrome state that cross components: whether the rail is
 * showing, and whether the command palette is open. Everything below is either
 * presentational or reads the pathname for itself.
 */
export function ChromeShell({ role, groups, viewerSwitcher, children }: ChromeShellProps) {
  const pathname = usePathname();
  const [railVisible, setRailVisible] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const breadcrumb = useMemo(() => resolveBreadcrumb(pathname, groups), [pathname, groups]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="bg-bg flex min-h-dvh">
      {/*
       * The desktop rail is compact by default and opens on hover/focus. inert,
       * not conditional rendering: a hidden rail must not still be tabbable.
       */}
      <aside
        id="firma23-sidebar"
        inert={!railVisible}
        className={cn(
          'group/sidebar bg-rail ease-firma sticky top-0 hidden h-dvh shrink-0 overflow-hidden py-3 transition-[width,opacity] duration-300 md:block',
          railVisible
            ? 'w-[92px] opacity-100 hover:w-[292px] focus-within:w-[292px]'
            : 'w-0 opacity-0',
        )}
      >
        <Sidebar
          role={role}
          groups={groups}
          viewerSwitcher={viewerSwitcher}
          onOpenSearch={() => setSearchOpen(true)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          sidebarOpen={railVisible}
          onToggleSidebar={() => setRailVisible((value) => !value)}
          onOpenSearch={() => setSearchOpen(true)}
          breadcrumb={breadcrumb}
        />

        {/* Bottom padding clears the fixed mobile tab bar. */}
        <main
          id="main-content"
          className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </main>
      </div>

      <MobileTabBar role={role} />

      {searchOpen ? (
        <CommandPalette onClose={() => setSearchOpen(false)} groups={groups} role={role} />
      ) : null}
    </div>
  );
}
