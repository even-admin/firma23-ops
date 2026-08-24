import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/opportunities',
  useRouter: () => ({ push }),
}));

import { ChromeShell } from '@/components/chrome/ChromeShell';
import { copy } from '@/copy/es-MX';
import { buildNavGroups } from '@/lib/nav';

const SIDEBAR_MODE_KEY = 'firma23.sidebar-mode';

/**
 * This Node install's built-in global `localStorage` (jsdom 26 defers to it
 * rather than shipping its own) is a non-functional stub without a
 * `--localstorage-file` path — every Storage method is `undefined`, even
 * though a real browser's `window.localStorage` is always fully functional
 * regardless of what Node built the app with. A small working stand-in,
 * scoped to this file, lets these tests exercise the actual persistence
 * logic instead of a broken host object.
 */
function installMemoryStorage(): Storage {
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
  return storage;
}

function shell() {
  return (
    <ChromeShell
      role="founder"
      groups={buildNavGroups({ projects: [] })}
      viewerSwitcher={null}
    >
      <p>contenido</p>
    </ChromeShell>
  );
}

/**
 * Foundation's sidebar contract: saved mode is compact or hidden, compact is
 * the only safe first-visit/no-storage default, and the toggle persists.
 * These exercise ChromeShell directly rather than Sidebar in isolation
 * because the mode and its persistence live in ChromeShell, not the panel.
 */
describe('ChromeShell sidebar persistence', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installMemoryStorage();
  });

  it('defaults to compact on first visit with no saved preference', () => {
    render(shell());
    expect(document.getElementById('firma23-sidebar')).not.toHaveAttribute('inert');
  });

  it('restores a saved hidden mode after mount', async () => {
    storage.setItem(SIDEBAR_MODE_KEY, 'hidden');
    render(shell());
    await waitFor(() => {
      expect(document.getElementById('firma23-sidebar')).toHaveAttribute('inert');
    });
  });

  it('persists the toggled mode and returning from hidden restores compact', async () => {
    render(shell());
    const toggle = screen.getByRole('button', { name: copy.nav.hide });

    fireEvent.click(toggle);
    expect(storage.getItem(SIDEBAR_MODE_KEY)).toBe('hidden');
    await waitFor(() => {
      expect(document.getElementById('firma23-sidebar')).toHaveAttribute('inert');
    });

    fireEvent.click(screen.getByRole('button', { name: copy.nav.show }));
    expect(storage.getItem(SIDEBAR_MODE_KEY)).toBe('compact');
    await waitFor(() => {
      expect(document.getElementById('firma23-sidebar')).not.toHaveAttribute('inert');
    });
  });

  it('fails safe to compact, without crashing, when local storage throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('storage disabled');
        },
        setItem: () => {
          throw new Error('storage disabled');
        },
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      } satisfies Storage,
    });

    render(shell());
    expect(document.getElementById('firma23-sidebar')).not.toHaveAttribute('inert');
  });
});

function firstSearchOpener(): HTMLElement {
  const [opener] = screen.getAllByRole('button', { name: copy.search.open });
  if (opener === undefined) throw new Error('expected at least one search-open button');
  return opener;
}

function firstAndLast(elements: NodeListOf<Element>): readonly [HTMLElement, HTMLElement] {
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (first === undefined || last === undefined) throw new Error('expected a focusable element');
  return [first as HTMLElement, last as HTMLElement];
}

describe('ChromeShell command palette', () => {
  afterEach(() => {
    push.mockClear();
  });

  it('marks the rest of the shell inert while open', () => {
    render(shell());
    const opener = firstSearchOpener();
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.getElementById('firma23-sidebar')?.closest('[inert]')).not.toBeNull();
  });

  it('restores focus to the exact opener on close', () => {
    render(shell());
    const opener = firstSearchOpener();
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });

  it('keeps the original opener when Cmd/Ctrl+K repeats while already open', () => {
    render(shell());
    const opener = firstSearchOpener();
    opener.focus();

    // Opens via the shortcut, with the real opener focused — same as a user
    // pressing it once.
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The shortcut's listener lives on `window`, which the palette's `inert`
    // background does not silence, so this fires again while the dialog is
    // still open and focus has moved to its input. Without the `searchOpen`
    // guard in ChromeShell's `openSearch`, this would overwrite the captured
    // opener with that input.
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });

  it('traps Tab within the dialog instead of leaking to the rest of the page', () => {
    render(shell());
    const opener = firstSearchOpener();
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog');
    const [first, last] = firstAndLast(
      dialog.querySelectorAll('a[href], button:not([disabled]), input'),
    );

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe('ChromeShell main landmark', () => {
  it('gives #main-content a programmatic tab stop so the skip link can focus it', () => {
    render(shell());
    expect(document.getElementById('main-content')).toHaveAttribute('tabindex', '-1');
  });
});
