# UI-INICIO handoff

## Provenance

- Branch: `ui-inicio-dashboard`.
- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/bridgetown`.
- Bootstrap/base SHA, confirmed identical to `git merge-base HEAD
  origin/ui-integration` before any edit: `d0a9583030159da43014249b205547c77f85c638`
  (this is also the accepted `UI-FOUNDATION` SHA's descendant tip on this branch
  — `git log` shows the Foundation commits `39d361f`, `5c1cff7`, `880d23b`,
  `27deb89` in the ancestry, plus one further doc commit `d0a9583`).
- `git status --porcelain=v1` was empty and `git branch --show-current` reported
  `ui-inicio-dashboard` before any edit.
- Implementation SHA (the only code/test commit in this pass):
  `6dfb1277e91e734d0629875c4ba409f6b2d30f00`.
- This file is committed separately, after the implementation SHA above, so its
  own commit SHA is not knowable from inside itself. **The reviewable candidate
  HEAD is whatever `git rev-parse HEAD` on `ui-inicio-dashboard` reports after
  this file's commit — not `6dfb127` alone.**
- Worktree was clean immediately before the implementation commit and again
  immediately before the Mode P build.

## Owned files changed

All within `UI-INICIO` exclusive ownership per
`docs/UI-WORKSPACE-LAUNCH-PLAN.md`'s ownership matrix:

- `src/app/(network)/page.tsx` — modified.
- `src/components/dashboard/NextActionQueue.tsx` — new.
- `src/components/dashboard/AssignmentQueue.tsx` — new.
- `tests/components/dashboard-inicio.test.tsx` — new, uniquely named.
- `docs/ui-handoffs/UI-INICIO.md` — this file.

No Foundation chrome (`OperationalHeader`, `MeshDriftCanvas`, sidebar, command
palette), shared surfaces (`AssignmentRow`, `StatusPill`, `RailStateBadge`,
`Amount`, `src/copy/es-MX.ts`), `src/types/**`, `src/data/**`, `src/lib/**`,
Auth, Supabase, packages, or any other route were touched. No new copy string
was introduced — every visible label continues to come from the existing
`copy.home.*` keys already read by the previous version of this page.

## What changed and why

The previous `HomePage` rendered `home.nextActions` and `home.assignments` in
plain dataset order, inline in the route file. Per
`docs/UI-DIRECTION.md` ("Inicio: refine next actions and assignments using the
existing `PersonalHome` model... make the first screen feel like a young
operational game") and `docs/DESIGN-DIRECTION.md` ("replace decorative charts
with actionable queues"), two presentational components now read that same
`PersonalHome` data as a ranked queue instead of raw insertion order:

1. **`NextActionQueue`** sorts `NextAction[]` so `tone: 'attention'` items
   (a founder's pending settlement review) lead and `tone: 'neutral'` items
   (an operator's evidence upload) follow, with a stable order preserved
   within each group. Each row gets a `label-micro tnum` ordinal badge
   (`01`, `02`, …) — the exact same styling `leaderboard/page.tsx` already
   uses for rank, reused here so a ranked list reads consistently across the
   app rather than inventing a new visual grammar. This is a pure reorder of
   data the repository already computed; no new field, no new copy, no
   business logic moved into the component.
2. **`AssignmentQueue`** sorts `HomeAssignment[]` so `active: true` rows
   (current, in-flight work) lead and settled/paid history trails. It still
   renders every row through the existing, shared `AssignmentRow` — the money
   badge, projected/approved/paid discrimination, and status pill are
   untouched, cross-lane-owned code.
3. `page.tsx` now delegates both sections to these components and no longer
   inlines the `<li>` markup or the tone-dot `cn()` call itself.

Nothing here invents a KPI, a hero, a fake metric, or an animation. The
ordering is a legitimate re-presentation of exactly the fields
`PersonalHome`/`HomeAssignment`/`NextAction` already expose (`tone`, `active`);
no repository, view model, or fixture changed.

## Commands and outcomes

Run against implementation SHA `6dfb1277e91e734d0629875c4ba409f6b2d30f00`,
worktree clean before and after:

```
npm run lint       0 problems
npm run typecheck  0 errors
npm test           306 passed (18 files — the new dashboard-inicio.test.tsx
                   adds 6; 300 passed/17 files before this change)
npm run build      succeeds — 15 routes + /_not-found, same route list as
                   before this change (this lane added no route)
```

`tests/components/dashboard-inicio.test.tsx` covers, against the real
`NextActionQueue`/`AssignmentQueue` components:

- empty states render `copy.home.noActions` / `copy.home.noAssignments` +
  `noAssignmentsDetail`;
- attention-tone actions rank ahead of neutral ones regardless of input order;
- the ordinal badge starts at `01`;
- active assignments rank ahead of settled/paid history;
- a projected assignment's row contains zero `[class*="money"]` elements
  (the same invariant `tests/components/surfaces.test.tsx` enforces on the
  Revenue Rail, re-verified here at the Home-specific call site).

### Mode P (fresh production server)

- Preflight: worktree clean; `$CONDUCTOR_PORT` (55130) free (`lsof` empty).
- `rm -rf .next && npm run build` → success. `.next/BUILD_ID` =
  `Q7EWwpQ9p8XIuKQskUH9A`.
- `npm run start -- --port 55130` (env `NEXT_PUBLIC_SUPABASE_URL=`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` blank) → PID 55669, started
  2026-08-25T07:39:36Z, `http://localhost:55130`.
- `GET /dev/states` → `HTTP 404` (mandatory, unauthenticated — passes).
- `GET /favicon.ico` → `HTTP 200`, `content-type: image/x-icon` (passes).
- `GET /` → `HTTP 307` to `/login?state=backend-unavailable`. This is the
  correct M2 Auth-repair behavior documented in `docs/INFRASTRUCTURE.md`
  (H1): a production build (`NODE_ENV=production` from `next start`) with no
  Supabase env vars fails closed to the login/unavailable state rather than
  falling open to the synthetic founder. Mode P therefore proves build/route
  health, not Home's presentation — Mode S below covers presentation.
- Process stopped; port confirmed free afterward (`lsof` empty).

### Mode S (synthetic presentation)

- Dev server started on port 55130 with both `NEXT_PUBLIC_SUPABASE_*` vars
  explicitly blank; `.env.local` does not exist in this workspace, so no real
  config could leak in. PID 56186, started 2026-08-25T07:40:09Z.
- Confirmed synthetic mode active: `/` resolved without a login redirect.
- Founder and member presentations were exercised **in-browser, through the
  real "Cambiar vista de prototipo" control** (not a forged cookie — the
  browser tool's own cookie-write path is blocked by its privacy guard,
  which is the right default, so the actual UI control was used instead,
  which is arguably better evidence anyway).

**Known tool limitation, same one `UI-FOUNDATION`'s handoff already
recorded:** this session's browser tool reports `resize_window` as
successful, but `window.innerWidth/innerHeight`, `outerWidth/outerHeight`,
and `screen.width/height` never change from a fixed virtual display
(measured at both a requested 375×812 and a requested 800×600 — both left
the real viewport at 1920×1080, and the tool's own `read_page` viewport
readout independently confirms `1920x1080`). **I could not land the exact
contracted 375/767/768/1280 widths in-browser and am recording that
honestly as `UNAVAILABLE` for pixel-exact capture, per the contract's
instruction not to substitute one mode/width for another.**

What was verified at the one real, available viewport (1920×1080, `outerWidth`
reported as 1456×819 — the environment's fixed capture size):

- `HOME`, founder role: renders; ordinal-ranked next actions show
  `01 Revisa liquidación` (SETY-0142), `02 Revisa liquidación` (SETY-0149),
  `03 Sube evidencia` (SETY-0149) — the two attention-tone settle actions
  correctly lead the one neutral evidence action, confirming the sort;
  one assignment (`Miel Kaab`, projected) renders with zero `money`-class
  elements in its row (checked via `document.querySelectorAll('[class*="money"]')`
  scoped to that row).
- `HOME`, member role (Sebastián Benítez): renders; assignments show
  `Tortillería La Ceiba` (active, en producción) and `Miel Kaab` (active,
  entregada) ahead of `Refaccionaria Maya Norte` (settled/`liquidada`,
  `active: false`) — confirms the active-first sort against real data with
  a genuine active/inactive mix; the settled row correctly carries the
  ledger-green `APROBADO` badge and a real `Amount`, distinct from the two
  muted projected rows above it.
- Both roles: exactly one `h1`; `document.documentElement.scrollWidth ===
  clientWidth` (no horizontal overflow at the available viewport); zero
  console errors or exceptions (`read_console_messages`, unfiltered and
  error-only, both empty across the whole session).
- Command palette (Foundation-owned, consumed unchanged): opens via the
  search button over the edited Home content, background dims/traps as
  before, closes on Escape, zero console errors — confirms this lane's
  edit did not regress the shared shell it renders inside of.

**Why I did not additionally fabricate the four exact widths by other
means:** CSS `zoom`/content-scale tricks change rendered pixel size but not
the CSS viewport width Tailwind's `sm:`/`lg:` media queries read, so they
would not actually exercise the breakpoints and would misrepresent
verification that didn't happen. I instead relied on code-level assurance
for the narrow/tablet cases: `page.tsx`'s outer container
(`px-4 py-6 sm:px-8 sm:py-8 lg:px-10`) is unchanged from the prior version;
`NextActionQueue`'s row (`flex flex-wrap items-center gap-x-3 gap-y-1`) is
the identical flex-wrap container the inline markup already used, with one
added inline ordinal span — flex-wrap means added content wraps rather than
overflows; `AssignmentQueue` delegates every row to the untouched, already
responsive `AssignmentRow` (`grid-cols-[1fr_auto] ... sm:grid-cols-[1fr_auto_auto]`).
No breakpoint class was added, removed, or altered by this lane.

### Mode D (configured Development founder)

**UNAVAILABLE.** Same as `UI-FOUNDATION`'s recorded state: no `.env.local`
exists in this workspace, no configured Supabase project is reachable from
here, and no real invited founder session exists to use from this workspace.
Honestly recorded as unavailable rather than substituted with Mode S. No
Mode D member row exists either (no real invite exists, consistent with the
contract).

## Screenshots (advisory only)

Under `.context/qa/UI-INICIO/6dfb1277e91e734d0629875c4ba409f6b2d30f00/`
(git-ignored, local only):

- `UI-INICIO-modeS-founder-home-1920x1080.jpg`
- `UI-INICIO-modeS-founder-home-1920x1080-viewerpopover.jpg`
- `UI-INICIO-modeS-member-home-1920x1080.jpg`

These are advisory local aids at the one real available viewport, not final
acceptance evidence — per the contract, only `UI-INTEGRATOR`'s fresh rerun of
the complete matrix on the final integrated candidate can claim browser
acceptance, and it must do so at the actual contracted widths regardless of
whatever tool limitation affected this lane's session.

## Shared / cross-ownership requests

`none`. No Foundation, shared-surface, copy, or product/backend contract
change was needed for this refinement.

## Confirmation

No unauthorized remote action occurred: no push, no PR, no merge, no deploy,
no Vercel change, no OTP, no Supabase mutation, no dependency installed. Every
server started during this session (Mode P PID 55669, Mode S PID 56186) was
stopped and its port (55130) confirmed free afterward. All work is committed
locally only, on `ui-inicio-dashboard`, not on `main` or `ui/integration`.
