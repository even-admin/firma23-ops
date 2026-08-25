'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { ChromeIcon, NavIcon } from '@/components/chrome/NavIcon';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import { containsActive, isActive, type NavGroup, type NavLeaf } from '@/lib/nav';
import type { ViewerRole } from '@/lib/viewer';

const ROW =
  'ease-firma group relative flex min-h-11 items-center rounded-[6px] pr-1.5 transition-colors duration-150';
const LABEL =
  'flex min-h-11 min-w-0 flex-1 items-center py-[7px] pr-1 text-[13px] tracking-wide';
const REVEAL =
  'ease-firma opacity-0 transition-[opacity,transform] duration-200 group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100';
const COLLAPSED_GLYPH_SLOT = 50;
const TREE_INDENT = 12;

function enabledFor(item: NavLeaf, role: ViewerRole): boolean {
  if (!item.available) return false;
  if (item.founderOnly && role !== 'founder') return false;
  return true;
}

function rowState(active: boolean, enabled: boolean): string {
  if (!enabled) return 'cursor-not-allowed text-rail-faint';
  if (active) return 'bg-rail-raised text-rail-ink font-medium';
  return 'text-rail-muted hover:bg-rail-hover hover:text-rail-ink';
}

/** Indentation follows depth so a nested list reads as a tree, not a flat list. */
function indentFor(level: number): number {
  return level * TREE_INDENT;
}

function guideLeftFor(level: number): number {
  return indentFor(level) + COLLAPSED_GLYPH_SLOT / 2;
}

function GlyphSlot({ children }: { readonly children: ReactNode }) {
  return (
    <span className="flex w-[50px] shrink-0 items-center justify-center">{children}</span>
  );
}

function CountBadge({ value, label }: { readonly value: number; readonly label: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="tnum border-attention/40 text-attention-rail flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-medium"
      >
        {value}
      </span>
      <span className="sr-only">{`${value} ${label}`}</span>
    </>
  );
}

interface SidebarItemProps {
  readonly item: NavLeaf;
  readonly role: ViewerRole;
  readonly pathname: string;
  readonly level?: number;
}

function SidebarItem({ item, role, pathname, level = 0 }: SidebarItemProps) {
  const enabled = enabledFor(item, role);
  const children = (item.children ?? []).filter((child) => enabledFor(child, role));
  const hasChildren = enabled && children.length > 0;

  const inside = containsActive(pathname, children);
  const active = enabled && (hasChildren ? pathname === item.href : isActive(pathname, item.href));

  // Navigating into a branch opens it. Leaving it does not slam it shut, so the
  // reader's own expand choice survives a round trip.
  const [open, setOpen] = useState(inside);
  const [wasInside, setWasInside] = useState(inside);
  if (inside !== wasInside) {
    setWasInside(inside);
    if (inside) setOpen(true);
  }

  const panelId = `nav-branch-${item.key}`;
  const content = (
    <>
      <GlyphSlot>
        <NavIcon
          name={item.icon}
          className={cn(
            'ease-firma transition-colors duration-150',
            enabled && !active && 'text-rail-faint group-hover:text-rail-muted',
          )}
        />
      </GlyphSlot>
      <span className={cn('min-w-0 truncate translate-x-1', REVEAL)}>{item.label}</span>
    </>
  );

  return (
    <div className="flex w-full flex-col">
      <div className={cn(ROW, rowState(active, enabled))}>
        {enabled ? (
          <Link
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(LABEL, hasChildren && 'pr-12')}
            style={{ paddingLeft: indentFor(level) }}
          >
            {content}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            title={item.available ? copy.states.permissionDenied : copy.nav.soon}
            className={cn(LABEL, 'cursor-not-allowed')}
            style={{ paddingLeft: indentFor(level) }}
          >
            {content}
          </span>
        )}

        {item.badge !== undefined ? (
          <span
            className={cn(
              'absolute translate-x-1',
              hasChildren ? 'right-12' : 'right-1.5',
              REVEAL,
            )}
          >
            <CountBadge value={item.badge} label={copy.nav.pendingApprovals} />
          </span>
        ) : null}

        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? copy.nav.collapseGroup : copy.nav.expandGroup} ${item.label}`}
            className={cn(
              'text-rail-faint hover:text-rail-ink ease-firma absolute right-0 flex size-11 shrink-0 translate-x-1 items-center justify-center rounded-[4px] opacity-0 transition-[color,opacity,transform] duration-150',
              'group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100',
            )}
          >
            <ChromeIcon
              name="chevron-right"
              strokeWidth={2}
              className={cn(
                'ease-firma size-3.5 transition-transform duration-200',
                open && 'rotate-90',
              )}
            />
          </button>
        ) : null}
      </div>

      {hasChildren ? (
        <div
          id={panelId}
          className={cn(
            'ease-firma grid transition-[grid-template-rows,opacity] duration-300',
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            {/* The guide line is the only thing holding a nested list together. */}
            <span
              aria-hidden="true"
              className="border-rail-line absolute top-0 bottom-0 border-l"
              style={{ left: guideLeftFor(level) }}
            />
            {children.map((child) => (
              <SidebarItem
                key={child.key}
                item={child}
                role={role}
                pathname={pathname}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface OrgSwitcherProps {
  readonly role: ViewerRole;
  readonly viewerSwitcher: ReactNode;
}

/**
 * Organisation block and prototype viewer switch.
 *
 * The only thing this can switch in M1 is which viewer the synthetic
 * repositories are asked about, so the panel says so rather than implying an
 * account boundary that does not exist yet.
 */
function OrgSwitcher({ role, viewerSwitcher }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={copy.nav.switchViewer}
        className="hover:bg-rail-hover ease-firma group mb-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-0 py-2 transition-colors duration-150"
      >
        <span className="flex min-w-0 items-center">
          <GlyphSlot>
            <span
              aria-hidden="true"
              className="bg-ink-950 text-paper-000 flex size-9 shrink-0 items-center justify-center rounded-[6px] text-[13px] font-semibold tracking-[-0.055em]"
            >
              F23
            </span>
          </GlyphSlot>
          <span className={cn('ml-3 flex min-w-0 translate-x-1 flex-col items-start', REVEAL)}>
            <span className="text-rail-ink mb-1 truncate text-[13px] leading-none font-medium">
              {copy.app.name}
            </span>
            <span className="text-rail-faint truncate text-[11px] leading-none">
              {copy.nav.orgSubtitle} ·{' '}
              {role === 'founder' ? copy.viewer.founder : copy.viewer.member}
            </span>
          </span>
        </span>
        <ChromeIcon
          name="chevron-down"
          className={cn(
            'text-rail-faint group-hover:text-rail-muted ease-firma size-4 shrink-0 translate-x-1 opacity-0 transition-[color,opacity,transform] duration-200 group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:translate-x-0 group-focus-within/sidebar:opacity-100',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <>
          <span
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 block"
          />
          <div className="border-rail-line-strong bg-rail-hover absolute top-[52px] left-0 z-50 w-full rounded-lg border p-3">
            {viewerSwitcher}
          </div>
        </>
      ) : null}
    </div>
  );
}

interface SidebarProps {
  readonly role: ViewerRole;
  readonly groups: readonly NavGroup[];
  readonly viewerSwitcher: ReactNode;
  readonly onOpenSearch: () => void;
}

export function Sidebar({ role, groups, viewerSwitcher, onOpenSearch }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="on-rail border-rail-line bg-rail ease-firma mx-3 flex h-full flex-col overflow-hidden rounded-lg border p-2">
      <OrgSwitcher role={role} viewerSwitcher={viewerSwitcher} />

      <nav
        id="firma23-sidebar-nav"
        aria-label={copy.nav.primary}
        className="no-scrollbar mt-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      >
        <button
          type="button"
          onClick={onOpenSearch}
          className={cn(ROW, rowState(false, true), 'w-full')}
        >
          <span className={LABEL} style={{ paddingLeft: indentFor(0) }}>
            <GlyphSlot>
              <ChromeIcon
                name="search"
                className="text-rail-faint group-hover:text-rail-muted size-5 shrink-0"
              />
            </GlyphSlot>
            <span className={cn('min-w-0 truncate translate-x-1', REVEAL)}>
              {copy.search.open}
            </span>
          </span>
          <kbd
            className={cn(
              'border-rail-line-strong text-rail-faint h-5 items-center justify-center rounded-[4px] border px-1.5 font-mono text-[10px] font-medium',
              'hidden group-hover/sidebar:inline-flex group-focus-within/sidebar:inline-flex',
            )}
          >
            {copy.search.shortcut}
          </kbd>
        </button>

        {/*
         * Labelled groups rather than headings. A heading here would land above
         * the page's h1 in document order and break the outline of every route.
         */}
        {groups.map((group) => (
          <div
            key={group.key}
            role="group"
            aria-labelledby={`nav-group-${group.key}`}
            className="flex flex-col gap-0.5"
          >
            <span
              id={`nav-group-${group.key}`}
              className={cn(
                'text-rail-faint mb-1 translate-x-1 px-2.5 text-[11px] font-semibold tracking-wider uppercase',
                REVEAL,
              )}
            >
              {group.heading}
            </span>
            {group.items.map((item) => (
              <SidebarItem key={item.key} item={item} role={role} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-rail-line mt-auto flex flex-col gap-0.5 border-t pt-4">
        <div className="flex min-h-11 items-center px-0 py-[7px]">
          <GlyphSlot>
            <span
              aria-hidden="true"
              className="border-rail-line-strong text-rail-ink flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold uppercase"
            >
              {role === 'founder' ? 'F' : 'O'}
            </span>
          </GlyphSlot>
          <span className={cn('ml-3 flex min-w-0 translate-x-1 flex-col', REVEAL)}>
            <span className="label-micro text-rail-faint">{copy.nav.session}</span>
            <span className="text-rail-ink truncate text-[13px] font-medium">
              {role === 'founder' ? copy.viewer.founder : copy.viewer.member}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
