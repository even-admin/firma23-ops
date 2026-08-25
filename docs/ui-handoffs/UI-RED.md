# UI-RED handoff

## Provenance

- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/port-louis`
- Branch: `ui-red-operator-card-identity`
- Bootstrap/base SHA (dispatch HEAD, confirmed exactly, per the dispatch's STOP
  condition): `d0a9583030159da43014249b205547c77f85c638` — matches
  `git merge-base HEAD origin/ui/integration` before any edit.
- Worktree was clean (`git status --porcelain=v1` empty) at the start of the
  session, immediately before the Mode P build, and after this document was
  written.
- Implementation SHA (the commit carrying the actual code/test change):
  `f3b7148b771e37f1b594f0ec171daa46c8826187`.
- This handoff commit lands after the implementation commit, so its own SHA is
  not knowable from inside this file. **The reviewable candidate is whatever
  `git rev-parse HEAD` on `ui-red-operator-card-identity` reports after this
  file is committed**, not the implementation SHA quoted above.

## Owned files changed

All within `UI-RED` exclusive ownership per
`docs/UI-WORKSPACE-LAUNCH-PLAN.md`'s ownership matrix:

- `src/components/operator/OperatorCard.tsx`
- `src/components/operator/AvailabilityBadge.tsx`
- `tests/components/red-operator-identity.test.tsx` (new, uniquely named)
- `docs/ui-handoffs/UI-RED.md` (this file)

Not touched: `SkillChips.tsx`, `StatGrid.tsx`, network list/profile *page*
files, `AssignmentRow.tsx`, any shared surface, copy, types, data, lib, Auth,
Supabase, packages, or deployment configuration. No new copy key was added —
every string is `copy.network.*` or `copy.home.activeWork`, both already
defined and already used elsewhere in the app.

## What changed and why

Per `docs/UI-DIRECTION.md`'s Red section ("Evolve Operator Card into the
Player identity surface using only existing skills, outcomes, approved/paid
earnings and availability") and the reference catalog's Glass Profile Card
entry ("Extract: Identity focal hierarchy only. Reject glass, blur, neon,
photos, remote avatars"):

1. **Identity focal hierarchy, stronger on the profile hero.**
   `OperatorCard` already carried an outlined initials mark, name, role/joined
   line and availability badge, but gave the profile page (`headingLevel="h1"`)
   the exact same scale as a dense directory card (`headingLevel="h2"`). The
   mark now grows from `size-11` to `size-14` and the name from `text-lg` to
   `text-2xl sm:text-3xl` only when it is the page's own subject, so a
   member's own profile reads as a focal identity moment instead of a
   grid-card at 1:1 scale. The dense directory list is visually unchanged.
2. **A real handle, only where there is room for it.** The profile hero now
   shows `@{operator.slug}` next to the name in monospace, sourced from the
   same `slug` field already used for the profile URL — no new data, no
   invented gamertag. Deliberately gated to `headingLevel === 'h1'` only: in
   the dense two-column directory grid, adding a second wrapped text element
   next to a `truncate` heading risked exactly the "wobble" class of bug
   Foundation had already found and fixed once in the sidebar, so it stays off
   the list card entirely.
3. **A visible status dot on `AvailabilityBadge`.** The badge already carried
   the correct semantic tone per availability value (`border-line-strong`
   open, `attention` limited, `faint` unavailable); it had no glyph, only
   text. Added a `size-1.5 rounded-full bg-current` dot before the label —
   `currentColor`, so it inherits the exact same tone, no new token, no new
   colour. This is the ordinary system/instrument status-dot pattern the
   direction's "Systems" mode already uses conceptually, applied here as pure
   CSS with zero JS and zero new dependency.
4. **`activeWorkCount` surfaced for the first time.** `OperatorCardView`
   already carried a real, repository-derived `activeWorkCount` field (used
   on Home's `OperationalHeader`) that no Red surface rendered anywhere. It
   now appears as a plain count + the existing `copy.home.activeWork` label,
   right-aligned under the availability badge, and only when
   `activeWorkCount > 0` — a card with no active work shows nothing rather
   than a hollow "0". This directly answers "make identity strong and
   youthful" with a real, derived, already-existing signal instead of
   inventing streaks, XP, or any of the token/spend/commit competition the
   dispatch explicitly forbids.

Explicitly rejected, and why: no glass/blur/neon, no photos or remote avatar
images (the identity mark stays an initials tile, unchanged in kind), no
pixel/8-bit "Player" styling (the reference catalog gates that behind
`xp_events`, which does not exist yet — out of scope for this lane), no new
copy string, no chart, no invented delta/trend on `StatGrid`.

## Commands and outcomes

All run against implementation SHA `f3b7148b771e37f1b594f0ec171daa46c8826187`
unless noted:

```
npx vitest run tests/components/red-operator-identity.test.tsx \
  tests/components/surfaces.test.tsx   -> 40 passed (2 files)
npm test                               -> 308 passed (18 files)
npm run lint -- --ignore-pattern ".context/**"  -> 0 problems
npm run typecheck                      -> 0 errors
```

`npm run lint` is run with the same `--ignore-pattern ".context/**"` Foundation
recorded: a gitignored, non-source `.context/` artifact directory is present
in this workspace and `eslint.config.mjs` (frozen, out of Red's ownership)
does not ignore it, so a bare `eslint .` reports unrelated noise from
generated output. The tracked source itself is `0 problems` either way.

`tests/components/surfaces.test.tsx` is an Integrator-owned shared test that
already exercises `OperatorCard`, `AvailabilityBadge`, `SkillChips` and
`StatGrid` against a fixture `OperatorCardView` with `activeWorkCount: 2`; it
passed unmodified against the new rendering, confirming the change is additive
and non-breaking for that shared surface. `src/app/dev/states/page.tsx`
(Integrator-owned) renders `AvailabilityBadge`, `SkillChips` and `StatGrid`
directly with its own fixtures, including empty/zero states; it was read, not
edited, and nothing in this change alters those components' prop shapes
(`src/types/views.ts` is frozen and was not touched).

### Mode P (fresh production server)

- Preflight: `git status --porcelain=v1` empty at `f3b7148b771e37f1b594f0ec171daa46c8826187`.
- `$CONDUCTOR_PORT` (55150) confirmed free before start (`lsof` empty).
- `rm -rf .next && npm run build` -> success, 13 app routes + `/_not-found`,
  same route table as the base SHA.
- `.next/BUILD_ID` = `asGSyt6j8Hx1zWXTl4m3`, recorded immediately after build,
  2026-08-25 01:43:05 CST.
- `npm run start -- --port 55150` -> launcher PID 60007, actual listening
  process PID 60028, started 2026-08-25 (see server log timestamp above).
- `GET /dev/states` -> `HTTP 404` (mandatory, unauthenticated — passes).
- `GET /favicon.ico` -> `HTTP 200`, `content-type: image/x-icon` (passes).
- Role/HTTP-404 subset in Mode P: this workspace has no `.env.local` and no
  configured Supabase project, so every role-gated route
  (`/network`, `/network/*`) redirects to `/login?state=backend-unavailable`
  under real Auth, exactly as the launch contract anticipates for an
  unconfigured environment ("Repeat the HTTP check against Mode P only when a
  valid configured founder session can be supplied ... otherwise record that
  production-authenticated subset as unavailable"). **Recorded as
  `UNAVAILABLE`**, matching UI-FOUNDATION's own Mode P scope, not substituted
  with Mode S.
- Stopped the launched process (PID 60028); `lsof -i :55150` confirmed empty
  afterward.

### Mode S (synthetic presentation)

- No `.env.local` exists in this workspace at all (confirmed via `ls`), so no
  real Supabase config could leak in regardless of the explicit blank
  environment variables.
- Fresh dev server started with
  `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` explicitly
  blank in the process environment, on `$CONDUCTOR_PORT` (55150), launcher PID
  61213, actual listening PID 61237.
- Confirmed synthetic mode active: `/` renders the synthetic founder viewer
  "Luis Ramírez" with no login redirect, both with and without a viewer
  cookie.
- Dynamic HTTP 404 matrix (curl, both roles):
  - `/network/nope`, founder cookie -> `404`
  - `/network/nope`, member cookie -> `404`
  - `/network/nope`, no cookie (defaults to member) -> `404`
  - `/network/sebastian-benitez`, founder cookie -> `200`
  - `/network/sebastian-benitez`, member cookie -> `200`
  - `/network`, founder cookie -> `200`
  - `/network`, member cookie -> `200`
- Browser pass (Chrome, `claude-in-chrome`), both roles, routes `NETWORK`,
  `MEMBER` (`sebastian-benitez`, `luis-ramirez`, `diego-martinez-hernandez`),
  and invalid `MEMBER` (`/network/nope`):
  - Availability status dot renders correctly for `open`/`limited` tones,
    inherits colour via `currentColor`, no image/photo anywhere
    (`container.querySelector('img')` empty in test; visually confirmed no
    `<img>` in the rendered header in the browser).
  - `activeWorkCount` line renders only when > 0 (e.g. "1 TRABAJO ACTIVO",
    "2 TRABAJO ACTIVO"); Diego Martínez Herrera's card and other zero-active
    members correctly show nothing.
  - Profile hero (`h1`) shows the enlarged identity mark, `@slug` handle next
    to the name, and the same availability/active-work column as the list
    card, at greater scale.
  - Directory list cards (`h2`) are visually unchanged in scale — no handle,
    same `size-11` mark, same `text-lg` name.
  - Verified vs. self-reported skill distinction (solid vs. dashed border)
    renders correctly on both the card and the profile's own "Habilidades"
    section.
  - Portfolio evidence renders with "VERIFICADO" tags on the profile page.
  - Exactly one `h1` on the profile page (`document.querySelectorAll('h1')`
    -> `1`, text `"Sebastián Benítez"`); heading order is `h1` ->
    `h2` (Habilidades) -> `h2` (Portafolio) -> `h2` (Trabajo reciente) — no
    skipped level.
  - Invalid profile (`/network/nope`) renders the shared not-found page
    (`src/app/(network)/not-found.tsx`, not owned by this lane) with exactly
    one `h1` ("No encontramos eso") and zero console errors.
  - `document.documentElement.scrollWidth === clientWidth` on `NETWORK` at the
    available viewport — no horizontal overflow.
  - Zero `money`-classed elements inside any projected subtree: on
    `sebastian-benitez`'s "Trabajo reciente", the two `PROYECCIÓN` rows
    (Tortillería La Ceiba, Miel Kaab) carry no `[class*="money"]` node; only
    the one `LIQUIDADA`/`APROBADO` row does.
  - Keyboard/focus: clicking an operator name focuses the real `<a>` element
    (`href` resolves to `/network/<slug>`, `min-h-11` satisfied); the search
    button correctly focuses the command-palette input, confirming the shared
    focus/command-palette contract (Foundation-owned, unmodified) still works
    alongside this lane's markup.
  - Console: zero errors on `NETWORK`, both `MEMBER` pages, and the invalid
    profile, both roles.
  - Network requests on a `MEMBER` load: 22 requests, all `200` (page
    document, fonts, dev/HMR chunks, favicon) — none failed.
  - Stopped the launched dev server (PID 61237); `lsof -i :55150` confirmed
    empty afterward (only the browser's own now-closed client sockets
    remained transiently in `CLOSE_WAIT`, which is not a listener).

### Mode D (configured Development founder)

**UNAVAILABLE.** Same as UI-FOUNDATION's own recorded state: this workspace
has no `.env.local`, no configured Supabase project reachable from here, and
no real invited founder session exists. Honestly recorded as unavailable
rather than substituted with Mode S.

## Known limitation: exact-pixel viewport matrix

The `claude-in-chrome` browser tool's `resize_window` call reported success
but did **not** change the actual rendered viewport in this sandboxed
environment: `window.innerWidth`/`innerHeight` stayed fixed at `1270x769`
across every attempted target (375x900, 500x850, 1280x900). This is the same
class of tool limitation UI-FOUNDATION's handoff already documented (it was
stuck at a fixed ~1910x990 for the same reason).

Consequence: the exact contracted widths **375, 767, 768** could not be
produced or measured in-browser from this workspace, and are recorded here as
`UNAVAILABLE` rather than claimed. The **1280** cell is approximated by the
environment's fixed 1270px viewport (10px short of exact) and is recorded as
such, not as an exact pass. All interaction/visual assertions above were
verified at that real 1270x769 viewport for both founder and member roles.
Responsive class usage in the changed files (`flex-wrap`, `min-w-0`,
`truncate`, conditional Tailwind classes gated only on `headingLevel`, no new
`sm:`/`lg:` breakpoint logic introduced) was additionally reviewed by
inspection: the change adds no new breakpoint-dependent layout, only
conditional styling driven by the existing `headingLevel` prop, so the
directory grid's established `lg:grid-cols-2` recomposition (unchanged by
this lane) is the only responsive behavior in play on this surface.

Per the launch contract, this lane's screenshots/evidence remain advisory;
`UI-INTEGRATOR` must freshly rerun the complete exact-width matrix on the
final integrated candidate regardless of what is recorded here.

## Unavailable/incomplete cases

- Mode D (founder and member): `UNAVAILABLE`, no configured environment or
  session (see above).
- Mode P role/HTTP-404 subset: `UNAVAILABLE`, no configured Supabase/Auth
  session in this workspace (see above).
- Exact 375px, 767px, 768px viewports: `UNAVAILABLE`, browser tool cannot
  resize the viewport in this environment (see above). 1280px is
  approximated at 1270px, not exact.

## Shared / cross-ownership requests

`none`. No frozen file needed a change: `AssignmentRow.tsx`,
`src/copy/es-MX.ts`, `src/types/views.ts`, `src/data/**`, `src/lib/**`, the
Foundation-owned chrome/shell, and Integrator-owned shared surfaces
(`src/app/dev/states/page.tsx`, `tests/components/surfaces.test.tsx`) were
read for compatibility but not edited. Every string used is an existing
`copy.network.*` or `copy.home.activeWork` entry.

## Confirmation

No unauthorized remote action occurred: no push, no PR, no merge, no deploy,
no Vercel change, no OTP, no Supabase mutation, no dependency install. All
servers started during this session (Mode P PID 60028, Mode S PID 61237) were
stopped and their ports confirmed free. All work is committed locally only, on
`ui-red-operator-card-identity`, not on `main` or `ui/integration`.
