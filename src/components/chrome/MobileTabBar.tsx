'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavIcon } from '@/components/chrome/NavIcon';
import { copy } from '@/copy/es-MX';
import { cn } from '@/lib/cn';
import { isActive, MOBILE_NAV_ITEMS } from '@/lib/nav';
import type { ViewerRole } from '@/lib/viewer';

interface MobileTabBarProps {
  readonly role: ViewerRole;
}

/**
 * A fixed-position pill nav has no way to reserve space for itself in a
 * scrollable page: whatever content the page happens to render underneath
 * its footprint gets covered, at any scroll position — including scroll
 * zero, on first paint, if a page's above-the-fold content happens to be
 * tall enough. Only the true end of the document is protected today, by
 * main's pb- reservation in ChromeShell.
 *
 * Guessing from scroll direction alone ("hide while scrolling down") does
 * not fix the first-paint case, since there has been no scroll event yet.
 * This instead asks the real DOM, at the bar's own exact footprint, whether
 * real rendered text sits there — on mount, on every scroll frame, and on
 * resize/orientation/content change — and only hides when it genuinely
 * does. That fixes first paint and every scroll position uniformly, for
 * any page's content, without a single page-specific magic number.
 */
/**
 * True only for a leaf element carrying its own visible text — a money
 * figure, a label, a heading. NOT true for a wrapping div/section/ul: those
 * have no rendered ink of their own at an arbitrary point inside them, even
 * though their aggregate `.textContent` (which includes every descendant)
 * would say otherwise. Checking `children.length === 0` is what excludes
 * that false signal — without it, hitting a list's flex container in the
 * *gap* between two cards would look identical to hitting real text, and
 * the bar would end up hidden almost permanently on any content-bearing
 * page, defeating its purpose as the primary mobile nav.
 */
function isMeaningfulContent(el: Element): boolean {
  if (el.closest('[data-mobile-nav-clearance]') !== null) return true;
  return el.children.length === 0 && (el.textContent ?? '').trim().length > 0;
}

const SAMPLE_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9];

function elementsBehindBar(nav: HTMLElement): boolean {
  // Hit-testing must see through the bar itself to whatever is beneath it,
  // AND must measure the bar's resting geometry, not whatever position a
  // translate transition happens to be interpolating through at this exact
  // instant. Skipping the second part is not cosmetic: reading
  // getBoundingClientRect() while this element is itself mid-transition
  // makes the sampled rectangle drift with the animation, so a hide
  // decision can sample a slightly different screen position than the one
  // that triggered it, occasionally find different content there, and flip
  // back — a real, observed oscillation, not a hypothetical one, that
  // showed up as the bar flickering continuously. Note this is the
  // standalone CSS `translate` property (Tailwind v4's translate-y-*
  // utilities), not the legacy `transform: translateY(...)` — overriding
  // `transform` here is a no-op against that. Both overrides are read back
  // synchronously in the same tick, before any repaint, so there is
  // nothing to restore-and-flicker from doing this.
  const previousPointerEvents = nav.style.pointerEvents;
  const previousTransition = nav.style.transition;
  const previousTranslate = nav.style.translate;
  nav.style.pointerEvents = 'none';
  nav.style.transition = 'none';
  nav.style.translate = 'none';

  const rect = nav.getBoundingClientRect();
  let hasVisibleTextBehind = false;
  if (rect.width > 0 && rect.height > 0) {
    // A single row of sample points can land exactly in the gap between two
    // stacked leaves (e.g. a label above an amount, inside one wrapping
    // div) and hit that wrapping div instead of either leaf — verified
    // against the real admin page layout. Sampling a small grid across the
    // bar's full height, not just its vertical center, is what actually
    // finds a leaf when one is there.
    hasVisibleTextBehind = SAMPLE_FRACTIONS.some((yFraction) => {
      const y = rect.top + rect.height * yFraction;
      return SAMPLE_FRACTIONS.some((xFraction) => {
        const x = rect.left + rect.width * xFraction;
        const hit = document.elementFromPoint(x, y);
        return hit !== null && !nav.contains(hit) && isMeaningfulContent(hit);
      });
    });
  }

  // Restore translate before transition: putting transition back first
  // would make this very restoration animate, a tiny but real, continuous
  // glitch since this runs on every scroll frame and every backstop tick.
  nav.style.pointerEvents = previousPointerEvents;
  nav.style.translate = previousTranslate;
  nav.style.transition = previousTransition;
  return hasVisibleTextBehind;
}

function useHideWhenOverlapping(navRef: RefObject<HTMLElement | null>, routeKey: string): boolean {
  const [hidden, setHidden] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    function check() {
      const nav = navRef.current;
      if (nav === null) return;
      setHidden(elementsBehindBar(nav));
    }

    function scheduleCheck() {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        check();
      });
    }

    // The bar persists across client-side navigations (it lives in
    // ChromeShell, above the routed page), so a route change alone does not
    // remount this hook. Re-check explicitly whenever routeKey changes,
    // otherwise a page navigated to at scroll zero would keep whatever
    // hidden state the previous page last computed.
    scheduleCheck();
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    window.addEventListener('resize', scheduleCheck);

    // A page can also grow or shrink without any scroll/resize/route event —
    // e.g. the admin intake panel expanding from its idle state into the
    // full draft review. Observing the document body catches that class of
    // change generically, without this shared chrome component needing to
    // know anything about any specific page's content. Guarded: jsdom (the
    // test environment) has no ResizeObserver, and a real but older browser
    // without it should just fall back to the scroll/resize/route checks
    // above rather than crash the whole nav.
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleCheck);
    resizeObserver?.observe(document.body);

    // Correctness backstop, not a primary mechanism: routes below
    // ChromeShell stream in via <Suspense> (see e.g.
    // src/app/(network)/admin/page.tsx), and this component mounts
    // immediately as part of the persistent shell — so the very first
    // check can run against a transient loading/hydration frame rather
    // than the settled page, with no scroll/resize/body-size event
    // guaranteed to mark the moment it settles. A slow, cheap re-check
    // guarantees any such stale reading self-heals within half a second,
    // without needing this component to know why a given frame was
    // transient. Interval, not a single delayed timeout: a one-shot retry
    // can itself land on another transient frame.
    const backstop = window.setInterval(scheduleCheck, 500);

    return () => {
      window.clearInterval(backstop);
      window.removeEventListener('scroll', scheduleCheck);
      window.removeEventListener('resize', scheduleCheck);
      resizeObserver?.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [navRef, routeKey]);

  return hidden;
}

/** Route-aware compact navigation adapted from the supplied expanding-pill pattern. */
export function MobileTabBar({ role }: MobileTabBarProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const hidden = useHideWhenOverlapping(navRef, pathname);

  return (
    <nav
      ref={navRef}
      aria-label={copy.nav.mobile}
      className={cn(
        'border-rail-line-strong bg-rail on-rail ease-firma fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex h-16 max-w-md items-center gap-1 rounded-full border p-1.5 transition-[transform,opacity] duration-200 md:hidden',
        // A keyboard user tabbing into a link inside must always be able to
        // see it, regardless of scroll state — focus-within overrides the
        // scroll-driven hide unconditionally.
        hidden
          ? 'pointer-events-none translate-y-24 opacity-0 focus-within:pointer-events-auto focus-within:translate-y-0 focus-within:opacity-100'
          : 'translate-y-0 opacity-100',
      )}
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const enabled = item.available && (!item.founderOnly || role === 'founder');
        const active = enabled && isActive(pathname, item.href);
        const classes = cn(
          'ease-firma relative flex min-h-12 min-w-11 items-center justify-center overflow-hidden rounded-full px-3 transition-[flex,color,background-color] duration-200',
          // A destination this viewer cannot open takes the least room, so the ones
          // they can open get the width instead.
          !enabled && 'text-rail-faint flex-none px-2',
          enabled && !active && 'text-rail-muted hover:bg-rail-hover hover:text-rail-ink flex-1',
          enabled && active && 'bg-rail-ink text-rail flex-[1.8]',
        );

        const content = (
          <>
            <NavIcon name={item.icon} className="size-5" />
            <span
              className={cn(
                'ease-firma overflow-hidden text-xs font-medium whitespace-nowrap transition-[max-width,opacity,margin] duration-200',
                active ? 'ml-2 max-w-20 opacity-100' : 'ml-0 max-w-0 opacity-0',
              )}
            >
              {item.label}
            </span>
          </>
        );

        if (!enabled) {
          return (
            <span
              key={item.key}
              aria-disabled="true"
              aria-label={item.label}
              title={copy.states.permissionDenied}
              className={classes}
            >
              {content}
            </span>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            className={classes}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
