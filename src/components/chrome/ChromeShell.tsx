'use client';

import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { CommandPalette } from '@/components/chrome/CommandPalette';
import { MobileTabBar } from '@/components/chrome/MobileTabBar';
import { Sidebar } from '@/components/chrome/Sidebar';
import { TopBar } from '@/components/chrome/TopBar';
import { cn } from '@/lib/cn';
import { resolveBreadcrumb, type NavGroup } from '@/lib/nav';
import type { ViewerRole } from '@/lib/viewer';

type SidebarMode = 'compact' | 'hidden';

const SIDEBAR_MODE_KEY = 'firma23.sidebar-mode';
// Same-tab writes do not fire the native `storage` event (only other tabs get
// that), so a write also dispatches this to wake this tab's own subscribers.
const SIDEBAR_MODE_EVENT = 'firma23:sidebar-mode-change';

function readStoredSidebarMode(): SidebarMode {
  try {
    return window.localStorage.getItem(SIDEBAR_MODE_KEY) === 'hidden' ? 'hidden' : 'compact';
  } catch {
    return 'compact';
  }
}

function writeStoredSidebarMode(mode: SidebarMode): void {
  try {
    window.localStorage.setItem(SIDEBAR_MODE_KEY, mode);
  } catch {
    // Storage is unavailable (private mode, quota, disabled). There is no
    // separate in-memory mode — the rendered mode always comes from
    // re-reading storage — so a failed write has no visible effect at all:
    // the next read (see below) still fails the same way and falls back to
    // compact. The toggle does not "still work this session"; it fails safe
    // to compact for the rest of it.
  }
  window.dispatchEvent(new Event(SIDEBAR_MODE_EVENT));
}

function subscribeSidebarMode(onStoreChange: () => void): () => void {
  window.addEventListener(SIDEBAR_MODE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(SIDEBAR_MODE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

/**
 * Compact is the only safe server snapshot: storage cannot be read on the
 * server, and `useSyncExternalStore` is built specifically to reconcile a
 * server snapshot that differs from the client's read (here, a saved
 * "hidden" preference) without logging a hydration mismatch.
 */
function getServerSidebarMode(): SidebarMode {
  return 'compact';
}

interface ChromeShellProps {
  readonly role: ViewerRole;
  readonly groups: readonly NavGroup[];
  readonly viewerSwitcher: ReactNode;
  readonly children: ReactNode;
}

/**
 * Holds the pieces of chrome state that cross components: the saved sidebar
 * mode, and whether the command palette is open. Everything below is either
 * presentational or reads the pathname for itself.
 */
export function ChromeShell({ role, groups, viewerSwitcher, children }: ChromeShellProps) {
  const pathname = usePathname();
  const sidebarMode = useSyncExternalStore(
    subscribeSidebarMode,
    readStoredSidebarMode,
    getServerSidebarMode,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchOpener, setSearchOpener] = useState<HTMLElement | null>(null);
  const [suppressSidebarPointer, setSuppressSidebarPointer] = useState(false);

  const toggleSidebar = () => {
    if (sidebarMode === 'hidden') setSuppressSidebarPointer(true);
    writeStoredSidebarMode(sidebarMode === 'hidden' ? 'compact' : 'hidden');
  };

  useEffect(() => {
    if (!suppressSidebarPointer) return;

    // The control that restores a hidden rail sits where the rail will appear.
    // Without this one-move guard, the unchanged pointer position immediately
    // matches :hover and turns a requested compact restore into a 292px flash.
    // Keyboard focus is unaffected; the first deliberate pointer move restores
    // ordinary hover behavior.
    const restorePointer = () => setSuppressSidebarPointer(false);
    window.addEventListener('pointermove', restorePointer, { once: true });

    return () => {
      window.removeEventListener('pointermove', restorePointer);
    };
  }, [suppressSidebarPointer]);

  // Captured here, before `searchOpen` flips and the rest of the shell goes
  // `inert`: a browser blurs the focused element the instant it becomes
  // inert, so reading `document.activeElement` any later would already miss
  // the real opener. Both state updates come from this one synchronous
  // handler, so React batches them — the read below always happens before
  // the palette mounts or `inert` applies.
  //
  // Guarded on `searchOpen`: the ⌘K shortcut keeps firing even while the
  // palette is open (its listener lives on `window`, which `inert` does not
  // touch), and by then `document.activeElement` is inside the dialog
  // itself. Without this guard, a repeated ⌘K would silently overwrite the
  // real opener with the palette's own input.
  const openSearch = useCallback(() => {
    if (searchOpen) return;
    setSearchOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSearchOpen(true);
  }, [searchOpen]);

  const breadcrumb = useMemo(() => resolveBreadcrumb(pathname, groups), [pathname, groups]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `openSearch` closes over `searchOpen` to guard re-opening; re-running
    // this effect whenever that identity changes keeps the check live
    // instead of trapping the listener on the initial (always-false) closure.
  }, [openSearch]);

  return (
    <div className="bg-bg flex min-h-dvh">
      {/*
       * inert, not just visually covered: while the palette is open, every
       * control behind it — rail, content, mobile tab bar — must be
       * unreachable by keyboard and assistive tech, not merely obscured by
       * the overlay's stacking order. display: contents keeps this wrapper
       * out of the flex layout entirely.
       */}
      <div className="contents" inert={searchOpen}>
        {/*
         * The desktop rail is compact by default and opens on hover/focus.
         * Width lives only here: the inner Sidebar panel tracks this box's
         * width as an ordinary block child, so compact and expanded never
         * disagree about how wide the rail is. inert, not conditional
         * rendering: a hidden rail must not still be tabbable.
         */}
        <aside
          id="firma23-sidebar"
          inert={sidebarMode === 'hidden'}
          className={cn(
            'group/sidebar bg-rail ease-firma sticky top-0 hidden h-dvh shrink-0 overflow-hidden py-3 transition-[width,opacity] duration-300 md:block',
            suppressSidebarPointer && 'pointer-events-none',
            sidebarMode === 'compact'
              ? 'w-[92px] opacity-100 hover:w-[292px] focus-within:w-[292px]'
              : 'w-0 opacity-0',
          )}
        >
          <Sidebar
            role={role}
            groups={groups}
            viewerSwitcher={viewerSwitcher}
            onOpenSearch={openSearch}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            sidebarOpen={sidebarMode === 'compact'}
            onToggleSidebar={toggleSidebar}
            onOpenSearch={openSearch}
            breadcrumb={breadcrumb}
          />

          {/* Bottom padding clears the fixed mobile tab bar. */}
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
          >
            {children}
          </main>
        </div>

        <MobileTabBar role={role} />
      </div>

      {searchOpen ? (
        <CommandPalette
          onClose={() => setSearchOpen(false)}
          groups={groups}
          role={role}
          opener={searchOpener}
        />
      ) : null}
    </div>
  );
}
