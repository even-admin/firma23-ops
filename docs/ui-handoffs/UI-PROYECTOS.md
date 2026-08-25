# UI-PROYECTOS handoff

## Provenance

- Branch: `ui-proyectos-record-table`.
- Bootstrap SHA (base), confirmed identical to `git rev-parse HEAD` and to
  `git merge-base HEAD origin/ui/integration` before any edit:
  `d0a9583030159da43014249b205547c77f85c638`.
- Worktree was clean (`git status --porcelain=v1` empty) at the start of this
  session, verified before any file was touched.
- This document is committed together with the code in the same local commit,
  so the reviewable candidate HEAD is whatever `git rev-parse HEAD` on
  `ui-proyectos-record-table` reports after that commit — not the bootstrap SHA
  above, which predates every change described here.

## Owned files changed

All within `UI-PROYECTOS` exclusive ownership per
`docs/UI-WORKSPACE-LAUNCH-PLAN.md`'s ownership matrix (project list/detail
pages, new `src/components/project/**`, new uniquely named Proyectos tests,
this handoff):

- `src/app/(network)/projects/page.tsx` — list page now delegates its record
  rendering to the new `ProjectRecordTable`; no data-fetching or permission
  logic changed.
- `src/app/(network)/projects/[projectSlug]/page.tsx` — detail page now uses
  the new `ProjectHeader` and `ProjectRuleHistory` components and reorders its
  sections to header → services → opportunities → rule history, matching the
  order named in `docs/UI-DIRECTION.md` ("Project detail adopts an exact
  header, services, opportunities and rule history") and in
  `docs/UI-REFERENCE-CATALOG.md` ("Project header, services, opportunities and
  rule history from existing models"). No data-fetching or permission logic
  changed.
- `src/components/project/ProjectRecordTable.tsx` (new) — the FIRMA23
  responsive record grammar for Proyectos: a semantic `<table>` shown at
  `768px` and above (`hidden md:table`), and a structured `<ul>` of rows shown
  below that (`md:hidden`), reading the same `ProjectSummary[]` in both
  branches so nothing is dropped on the narrow presentation. Columns/fields:
  project name + client (link to detail), status, service count, opportunity
  count, approved-settled money, and active-rule version (or the existing
  "sin regla" copy). No fabricated column (no health score, no trend, no
  invented timestamp).
- `src/components/project/ProjectHeader.tsx` (new) — the exact project/client
  header (client eyebrow, project name as the page's one `h1`, status pill,
  approved-settled money), extracted verbatim from what the detail page
  already rendered inline.
- `src/components/project/ProjectRuleHistory.tsx` (new) — renders
  `ProjectDetail.rules` newest-version-first and tags whichever rule matches
  `ProjectDetail.activeRule.id` with the existing "Regla activa" copy, so
  "current" is visually distinct from "history" for the first time. Renders
  the existing empty state when a project has no rule yet. This is a
  presentational reorganization of data the repository already returned
  (`ProjectRuleView[]`); no new field, no new repository call.
- `tests/components/project-record-table.test.tsx` (new, uniquely named).
- `tests/components/project-detail-view.test.tsx` (new, uniquely named).

No route pages outside `/projects` and `/projects/[projectSlug]`, no shared
component under `src/components/money|state|filter|finance|metrics|revenue-rail`,
no `StatusPill`/`AssignmentRow`, no `src/copy/es-MX.ts`, no `src/types/**`,
`src/data/**`, `src/lib/**`, Auth/Supabase, packages, or deployment
configuration were touched.

### On "evidence"

The task brief asked to organize "services, opportunities, current
rule/version history and evidence" from the existing view model.
`ProjectDetail` (`src/types/views.ts`) exposes `services`, `rules`,
`opportunities`, and money/status fields — it has no `evidence` field.
Evidence (`EvidenceView`) exists only on the opportunity-detail view model,
which is `UI-OPORTUNIDADES` ownership. Nothing was invented to fill that gap;
Proyectos organizes exactly what its own view model contains.

### Copy

`src/copy/es-MX.ts` is Integrator-owned and frozen; no key was added or
edited. Every string rendered by the new components already existed:
`copy.projects.*` for services/opportunities/rules/status/version labels, and
two column headers on the desktop table are reused from other namespaces that
already carry the exact right word: `copy.board.filterProject` ("Proyecto")
and `copy.board.filterStatus` ("Estado"). `StatusPill` itself (shared,
frozen) was not touched or extended — project status (`draft/active/closed`)
continues to use the same inline pill markup the page already had, since
`StatusPill`'s prop type is `OpportunityStatus` only.

## Commands and outcomes

```
npx vitest run tests/components/project-record-table.test.tsx tests/components/project-detail-view.test.tsx
  Test Files  2 passed (2)
       Tests  7 passed (7)

npm run lint        0 problems
npm run typecheck   0 errors
npm test            19 files passed, 307 passed (300 pre-existing + 7 new)
rm -rf .next && npm run build
  succeeds — 13 app routes + /_not-found, unchanged route list
  .next/BUILD_ID = 8Xr-Ycs3jlzuA5A62D9UD
```

Preflight: `git status --porcelain=v1` was clean before the build; the only
changes present anywhere in the tree during the build were the files listed
above.

## Server provenance

- Mode S: `next dev --port "$CONDUCTOR_PORT"` (`$CONDUCTOR_PORT=55170`),
  launched with `NEXT_PUBLIC_SUPABASE_URL=` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` explicitly blank in the process
  environment. `.env.local` does not exist in this workspace, so nothing real
  could leak in. Port confirmed free (`lsof` empty) before start.
- PID 62063, started 2026-08-25 01:44:29 CST, `http://localhost:55170`.
- `GET /` → HTTP 200 immediately after ready, confirming the server was up
  before any route check below.
- Stopped the launched process (`kill 62063`) at the end of the session;
  `lsof -i :55170` confirmed empty afterward.

## Dynamic 404 matrix (HTTP, both roles)

```
/projects/nope                                    no cookie (member default) -> HTTP 404
/projects/nope                     Cookie: f23_prototype_viewer=founder      -> HTTP 404
/projects/sety-2026                Cookie: f23_prototype_viewer=founder      -> HTTP 200
```

Matches the launch contract's required `/projects/nope -> 404` for both
roles. Project routes have no viewer-based branch in
`syntheticProjectRepository` (`list`/`getBySlug` both ignore their `viewer`
argument), so member and founder always render identically for Proyectos —
verified by reading the repository, not assumed.

## Known tool limitation: exact 375/767/768/1280 viewports were not reachable

`resize_window` did not change the rendered viewport in this session,
independent of the requested size. Three different tabs were tried,
requesting 1280×900, 2000×1000, 768×900, 767×900, 500×600, and 375×812 in
various orders; each tab converged to and stayed at one fixed size
(596×769 on one tab, 758×769 on two others) regardless of which size was
requested next, confirmed by reading `window.innerWidth`/`innerHeight`
directly after each attempt. This is the same limitation
`docs/ui-handoffs/UI-FOUNDATION.md` documented independently in its own
session ("I could not get the browser tool's viewport to actually land on
the four exact contracted widths"). I could not work around it from inside
the page (`document.cookie` writes were also blocked by the tool's own
safety guard, unrelated to this issue, when I tried an unrelated shortcut for
role-switching before finding the real in-app switcher).

What this means concretely: every browser check below is real, live-rendered
evidence at the two widths this environment actually produced — **596×769**
and **758×769** — not fabricated or interpolated. Both land below the 768
breakpoint, so they exercise the "structured rows" branch of
`ProjectRecordTable`, not the semantic-table branch. To still give real
evidence for the `>=768` branch without a false claim of having rendered it
at a wider viewport, I fetched the compiled stylesheet from the running dev
server and confirmed the exact rule the browser will apply at wider widths:

```css
@media (min-width: 48rem) {   /* 48rem = 768px, Tailwind's unmodified `md` breakpoint */
  .md\:hidden { display: none; }
  .md\:table  { display: table; }
}
```

No override of the `md` breakpoint exists anywhere in `src/app/tokens.css`,
`src/app/globals.css`, or `next.config.ts` — confirmed by direct search — so
this is the same, standard `768px` boundary the contract specifies. Combined
with confirming in a real browser that at an actual width below that boundary
(596px and 758px) `table` correctly computes to `display: none` and the
structured list correctly computes to `display: flex`, the only untested leg
is the browser's own standard media-query evaluation at the opposite side of
a boundary I've shown is wired to exactly 768px — not a leap I'm asking to be
trusted blindly, but not a live screenshot either. `UI-INTEGRATOR`'s fresh
regression, which the contract already requires before any final acceptance,
is the right place to confirm the `>=768` table rendering with a tool that
can actually reach that width.

## Mode S browser matrix (both real widths, both roles)

Routes covered: `/projects`, `/projects/sety-2026`, `/projects/ai-ops-retainer`,
`/projects/even-internal-2026` (zero-services/opportunities/rule fixture),
`/projects/nope`.

**596×769, member role (the session's default), then switched to founder via
the real in-sidebar "Cambiar vista de prototipo" control (confirmed by the
nav changing to include the founder-only `Oportunidades`/`Admin` links) and
re-checked `/projects`:**

- `/projects`: three project rows render (`SETY 2026`, `AI Ops Retainer`,
  `EVEN Interno 2026`), each as a structured `<li>` with name+client, status
  pill, services/opportunities/approved-settled/active-rule `dl`, and a link
  to its detail page. `EVEN Interno 2026` (status `draft`, no settlements, no
  active rule) correctly shows `$0.00` and "Sin regla de reparto todavía"
  rather than an invented rule. `document.documentElement.scrollWidth` (581)
  ≤ `innerWidth` (596): no horizontal overflow.
- `/projects/sety-2026`: exactly one `h1` ("SETY 2026"), client eyebrow
  ("SECRETARÍA DE ECONOMÍA Y TRABAJO DE YUCATÁN"), status pill "ACTIVO",
  "Liquidado y aprobado: $8,972.70" through `Amount`. Services (3, with
  version/milestone counts), Opportunities (3, each with its own status
  pill), then "Reglas de reparto" showing `v1` tagged "Regla activa" with its
  three share weights (Casa 30%, Cierre 20%, Producción 50%) and base-policy
  note — all read from the existing view model.
- `/projects/ai-ops-retainer`: same shape with different real numbers
  (`$25,000.00`, two service versions including one with `0 hitos`, one
  opportunity `PAGADA`, rule `v1` "Casa 25% / Cierre 25% / Implementación
  50%"). No crash on the zero-milestone service.
- `/projects/even-internal-2026`: services/opportunities/rules sections each
  render the existing dashed `EmptyState` with the existing copy
  ("Sin servicios definidos todavía" / "Sin oportunidades todavía" / "Sin
  regla de reparto todavía") instead of inventing placeholder rows.
- `/projects/nope`: HTTP 404 (confirmed above) and the shared not-found
  presentation ("No encontramos eso" / "Inicio" link); not a Proyectos-owned
  component.
- Keyboard: clicked into the list, then `Tab` moved real focus onto
  `SETY 2026`'s link and then `AI Ops Retainer`'s link
  (`document.activeElement` checked directly, not just visually); the
  focused link's computed style is `outline: rgb(10, 11, 12) solid 2px` with
  `outline-offset: 2px` (the existing global `:focus-visible` rule — nothing
  new needed) and its `getBoundingClientRect()` height is exactly `44px`.
- Console: zero errors or exceptions on every route above
  (`read_console_messages` with `onlyErrors: true`), checked fresh after each
  navigation.

**758×769, closest real width this environment reached to the 768
boundary, founder role:**

- `/projects`: `table` element's computed `display` is `none` and the
  structured list's is `flex`, consistent with 758 being 10px below the
  breakpoint; `scrollWidth` (758) ≤ `innerWidth` (758): no overflow even at
  this narrower-than-768 edge.
- `/projects/ai-ops-retainer`: renders identically to the 596px check above
  (one `h1`, correct money, correct rule tag and weights); `scrollWidth`
  (743) ≤ `innerWidth` (758); zero console errors.

## Mode D (configured Development founder)

**UNAVAILABLE.** Same basis as `docs/ui-handoffs/UI-FOUNDATION.md`: this
workspace has no `.env.local` and no configured Supabase project reachable
from here, and no real invited founder session exists. Honestly recorded as
unavailable rather than substituted with Mode S.

## Screenshots

No screenshots were persisted to disk this session — every visual state
above was inspected live during the browser session and its result recorded
in this document as text/DOM findings rather than saved PNGs. `UI-INTEGRATOR`
recaptures and revalidates visual evidence from the integrated candidate
regardless, per the contract, so no lane screenshot here would count as final
acceptance evidence either way.

## Shared / cross-ownership requests

`none`. No frozen file, shared surface, or centralized copy needed a change;
every string and component this lane needed already existed.

## Confirmation

No unauthorized remote action occurred: no push, no PR, no merge, no deploy,
no Vercel change, no OTP, no Supabase mutation, no dependency install. The
dev server launched during this session was stopped and its port confirmed
free. All work is committed locally only, on `ui-proyectos-record-table`, not
on `main` or `ui/integration`.
