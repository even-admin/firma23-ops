# UI-FOUNDATION handoff

## Provenance

- Branch: `firma23-sidebar-foundation`
- Bootstrap SHA (base): `dc54699b9c9be84504af237562cca6c12b1626ef` — the commit
  that introduced `docs/UI-WORKSPACE-LAUNCH-PLAN.md` on `ui-launch-contract`,
  confirmed identical to `git merge-base HEAD origin/ui-launch-contract` before
  any edit.
- Candidate SHA (head, after this work): `39d361f8981a1f0208146220bbdaf55aa94025ed`
- Worktree was clean (`git status --porcelain=v1` empty) at start, and clean
  again immediately before the Mode P build (required precondition for that
  mode).
- `docs/UI-WORKSPACE-LAUNCH-PLAN.md` itself is marked `Status: HOLD until this
  tracked contract passes read-only review` at the top of that file. I
  proceeded on the basis that being dispatched with the plan's own
  `UI-FOUNDATION builder prompt` verbatim reflects that review having already
  happened; flagging it here rather than silently assuming so.

## Owned files changed

All within Foundation ownership per the plan's ownership matrix:

- `src/components/chrome/ChromeShell.tsx`
- `src/components/chrome/Sidebar.tsx`
- `src/components/chrome/CommandPalette.tsx`
- `docs/DESIGN-DIRECTION.md` (MeshDrift gradient exception)
- `docs/M1-HANDOFF.md` (same exception, reconciling its own "no gradients"
  line — ownership matrix explicitly allows this file "only to reconcile the
  MeshDrift exception")
- `tests/components/chrome-shell-foundation.test.tsx` (new, uniquely named)
- `docs/ui-handoffs/UI-FOUNDATION.md` (this file)

No route pages, route components, `src/copy/es-MX.ts`, `src/lib/**`,
`src/data/**`, `src/types/**`, Auth/Supabase, packages, or deployment
configuration were touched.

## What changed and why

1. **Sidebar mode is now real state, not a boolean.** `ChromeShell` previously
   had a plain `useState(true)` for rail visibility with no persistence.
   Replaced with a `compact | hidden` mode read through `useSyncExternalStore`
   (subscribed to a `storage`/custom-event pair, not a raw
   `useEffect`+`setState` — the latter is now a lint error in this repo's
   `eslint-config-next`/`react-hooks` rules, and `useSyncExternalStore` is the
   React-native fix for exactly this "safe server snapshot, real client value"
   problem). Persists to `localStorage` under `firma23.sidebar-mode`. Reading
   and writing are both wrapped in `try/catch`, defaulting to `compact` on any
   failure, so unavailable storage fails safe without a crash or a hydration
   mismatch — verified in the browser and by test.
2. **One source of truth for sidebar width.** The `<aside>` slot in
   `ChromeShell` already sized itself correctly to the contract's exact
   numbers (92px compact, 292px hover/focus-expanded). But `Sidebar.tsx`'s own
   root `div` independently animated a *second*, different width scale
   (68px→260px, with a fixed `ml-3`), so the right-edge margin was 12px in
   compact and 20px in expanded — a visible "wobble" between the two states,
   not an aligned single object. `Sidebar`'s root now has no width classes at
   all; it fills its parent as an ordinary block box (`mx-3`, block-level flex
   container), so the aside's width is the only width in the system, and both
   left/right margins are the same 12px in both states.
3. **Command palette now actually traps focus and returns it to the exact
   opener.** Neither happened before: `Tab` from the last focusable element in
   the dialog escaped to the browser chrome, and closing (Escape, backdrop,
   the × button, or selecting a destination) never restored focus anywhere.
   Added a Tab/Shift+Tab cycle scoped to the dialog's own focusable elements,
   and focus restoration via the mount effect's cleanup (covers every close
   path uniformly, since the dialog only ever mounts while open). The opener
   is captured by the *caller* (`ChromeShell`), in the same synchronous click
   handler that flips `searchOpen`, deliberately *before* the rest of the
   shell goes `inert` — a browser blurs the focused element the instant it
   becomes inert, so capturing inside `CommandPalette`'s own effect would
   already be too late and would see `document.body` instead of the real
   opener. Also wrapped the rest of the shell (`aside` + content + mobile tab
   bar) in an `inert` container while the palette is open, so the background
   is genuinely unreachable by keyboard/AT, not merely covered by stacking
   order.
4. **Skip link now actually moves focus.** `<a href="#main-content">` existed,
   but `#main-content` had no `tabIndex`, so activating the link scrolled to
   it without moving keyboard/AT focus there — a common, easy-to-miss a11y
   gap. Added `tabIndex={-1}`. Verified in-browser: focusing and activating
   the real skip link moves `document.activeElement` to the `<main>` element.
5. **MeshDrift gradient exception documented.** `docs/DESIGN-DIRECTION.md` and
   `docs/M1-HANDOFF.md` both said "no gradients" unconditionally; both now
   name `MeshDriftCanvas` as the single approved exception, matching the
   language already in `docs/UI-WORKSPACE-LAUNCH-PLAN.md`. No code change was
   needed for the reduced-motion behavior itself —
   `src/components/visual/MeshDriftCanvas.tsx` already renders exactly one
   frame and stops (`if (!reduceMotion && ...) requestAnimationFrame(render)`)
   under `prefers-reduced-motion: reduce`, i.e. freezes without blanking, and
   the global CSS in `src/app/globals.css` already zeroes transition/animation
   durations under the same media query while leaving final layout state
   intact. Both were read and confirmed, not modified.

## Commands and outcomes

```
npm run lint       0 problems
npm run typecheck  0 errors
npm test           299 passed (17 files, including the new Foundation file)
npm run build      succeeds — 13 app routes + /_not-found, Mode P build
```

Full Mode P sequence, against candidate SHA `39d361f8981a1f0208146220bbdaf55aa94025ed`:

- Preflight: `git status --porcelain=v1` empty; `$CONDUCTOR_PORT` free before
  start (`lsof` empty).
- `rm -rf .next && npm run build` → success, `.next/BUILD_ID` =
  `J8Mb6PdW465T-gjNdySmY`.
- `npm run start -- --port "$CONDUCTOR_PORT"` → PID 66519 (parent launcher PID
  66501), started 2026-08-24 16:25:02 CST, URL `http://localhost:55120`.
- `GET /dev/states` → `HTTP 404` (mandatory, unauthenticated — passes).
- `GET /favicon.ico` → `HTTP 200`, `content-type: image/x-icon` (passes).
- Stopped the launched process; port confirmed free afterward.

## Mode S (synthetic)

Dev server started on `$CONDUCTOR_PORT` with
`NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`
explicitly blank in the process environment; `.env.local` does not exist in
this workspace at all, so no real Supabase config could leak in. Confirmed
synthetic mode active (home page renders the synthetic founder viewer "Luis
Ramírez" with no login redirect).

**Covered, in-browser, founder role, real viewport measured at ~1910×990** (see
"Known limitation" below — I could not get the browser tool's viewport to
actually land on the four exact contracted widths 375/767/768/1280; what I
verified is real desktop-bucket behavior, not pixel-exact matrix cells):

- `HOME` (`/`): renders; sidebar compact at rest, expands on hover, active row
  keeps a complete background shape, glyph/avatar centers align on one axis in
  both states (all confirmed visually and by re-reading the consolidated
  width/GlyphSlot code).
- Sidebar hide → reload → stays hidden (`localStorage` persisted) → no
  hydration-mismatch console warning (checked via `read_console_messages`,
  none found across the whole session).
- Sidebar show from hidden → rests at compact 92px, never a transient
  292px flash.
- Skip link: focusable, becomes visible on focus (`position: fixed`),
  activating it moves real DOM focus to `#main-content` (confirmed via direct
  DOM inspection, not just visual).
- Command palette: opens via the search button and via `⌘K`; input
  autofocuses; background (`#firma23-sidebar` and the rest of the shell) is
  genuinely `inert` while open (confirmed via `Element.closest('[inert]')`,
  not just visual overlay); `Tab` from the true last focusable element (a
  nested "Finanzas" destination under the Admin group — 12 focusable elements
  in total, not the 11 I first assumed, which is why my first wrap-check was
  one `Tab` short) wraps to the search input; `Shift+Tab` from the input wraps
  to that same last element; `Escape` closes the dialog and returns focus to
  the exact button that opened it (verified by reference equality in the
  page, not just by role/label).
- `ADMIN` → `FINANCE` (`/admin/finance`, founder-only): renders correctly
  under the same consolidated sidebar/shell, no overlap, active nav state
  correct, no console errors.
- Console: zero errors or warnings across the entire Mode S session (checked
  with and without a fresh reload, `onlyErrors` and unfiltered).

**Dynamic 404 matrix, Mode S founder, via HTTP client** (contract's fixture
list):

```
/projects/nope                                          -> HTTP 404  (pass)
/opportunities/00000000-0000-4000-8000-000000000000     -> HTTP 200  (FAIL, see below)
/network/nope                                            -> HTTP 404  (pass)
/leaderboard/nope/provenance                             -> HTTP 404  (pass)
```

**Finding, out of Foundation's ownership, not fixed:** the all-zero
opportunity UUID that the contract specifies as invalid returns `200` instead
of `404`. `src/app/(network)/opportunities/[opportunityId]/page.tsx` does call
`notFound()` correctly when
`syntheticOpportunityRepository.getById(...)` returns `null` — the gap is
that the repository call is evidently returning a non-null result for that ID
(repository/data layer, `src/data/**`, frozen for every UI lane, and route
page content besides). Recording this for whichever lane ends up owning
`UI-OPORTUNIDADES` and for Integrator's own fresh matrix run; not something I
attempted to fix or investigate further given ownership boundaries.

**Not covered — matrix cells I could not complete this session:**

- The full 12-route × {375, 767, 768, 1280} × {founder, member} grid. Given
  Foundation's actual edits are confined to shared chrome (sidebar, top bar,
  command palette, skip link), and the contract itself states screenshots and
  a lane's claims are advisory only — Integrator "must freshly rerun the
  complete matrix" regardless — I verified the shell-level behaviors above at
  representative routes rather than exhaustively sweeping all twelve routes
  at all four widths for both roles. Not a substitute for Integrator's
  mandatory full run; recorded here as a bounded, honest scope rather than a
  claim of full coverage.
- **Mobile viewport (375px) and the floating mobile route bar:** the
  browser automation's `resize_window` tool reported success but did not
  actually change the rendered viewport in this session (`window.innerWidth`
  stayed ~1910px after requesting 375×812, retried twice). Per the guidance
  not to loop on a non-responsive tool, I stopped after two attempts rather
  than keep retrying. `MobileTabBar.tsx` and the `md:`-breakpoint classes in
  `ChromeShell.tsx` were not edited by this work, so regression risk is low,
  but I did not visually confirm the mobile layout, the floating route bar,
  or its overlap-avoidance behavior in this session. **Recorded as
  UNAVAILABLE, not substituted.**
- **`prefers-reduced-motion: reduce` emulation:** no tool in this session's
  loaded set could toggle this media feature in the live browser. Verified
  instead by reading the actual source (see item 5 above) — this is
  code-review verification, not a live browser observation, and is called out
  as such rather than conflated with the Mode S browser pass.

## Mode D (configured Development founder)

**UNAVAILABLE.** This workspace has no `.env.local` and no configured
Supabase project reachable from here, and no real invited founder session
exists to use. Per the contract, honestly recorded as unavailable rather than
substituted with Mode S. No Mode D member row exists either, consistent with
the contract (no real invite exists).

## Screenshots (advisory only)

Under `.context/qa/UI-FOUNDATION/dc54699b9c9be84504af237562cca6c12b1626ef/`
(git-ignored, local only):

- `UI-FOUNDATION-modeS-founder-home-1910x990-compact-resting.jpg`
- `UI-FOUNDATION-modeS-founder-home-1910x990-compact-hover-expanded.jpg`

Widths reflect the real (unrequested) viewport the browser tool actually
rendered at, not the contract's exact checkpoints — see the mobile-viewport
limitation above. These are local, disposable aids only, not acceptance
evidence.

## Shared / cross-ownership requests

`none`. No frozen or Integrator-owned surface needed a change for this work.

## Confirmation

No unauthorized remote action occurred: no push, no PR, no merge, no deploy,
no Vercel change, no OTP, no Supabase mutation. All servers started during
this session were stopped and their ports confirmed free. All work is
committed locally only, on `firma23-sidebar-foundation`, not on `main` or
`ui-launch-contract`.
