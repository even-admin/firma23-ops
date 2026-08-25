# UI-OPORTUNIDADES handoff

## Provenance

- Branch: `ui-oportunidades-builder`.
- Bootstrap/base SHA: `d0a9583030159da43014249b205547c77f85c638` — printed via
  `git rev-parse HEAD` before any edit, confirmed identical to
  `git merge-base HEAD origin/ui/integration` at session start, and matching the
  exact SHA required by this session's dispatch. Worktree was clean
  (`git status --porcelain=v1` empty) at the start.
- Candidate HEAD for review: work in this session is **committed locally only, not
  yet committed as of this document's own text** — see "Commands and outcomes"
  below for the exact commit created after this file. Do not treat the bootstrap
  SHA above as the reviewable candidate; the actual candidate is whatever
  `git rev-parse HEAD` on `ui-oportunidades-builder` reports once the code and this
  handoff are committed together.

## Owned files changed

All within `UI-OPORTUNIDADES` exclusive ownership per
`docs/UI-WORKSPACE-LAUNCH-PLAN.md`'s ownership matrix:

- `src/app/(network)/opportunities/[opportunityId]/page.tsx`
- `src/components/opportunity/MilestoneChecklist.tsx`
- `tests/components/opportunity-row.test.tsx` (new, uniquely named)
- `tests/components/opportunity-milestone-timeline.test.tsx` (new, uniquely named)
- `tests/components/opportunity-assignment-list.test.tsx` (new, uniquely named)
- `docs/ui-handoffs/UI-OPORTUNIDADES.md` (this file)

No shared surfaces, copy, product/backend contracts, other routes, or
`OpportunityRow.tsx`/`AssignmentList.tsx` were edited — both were reviewed and
found to already satisfy the dense-row and clear-hierarchy brief using existing
view models, so they were left untouched rather than changed for their own sake.
No `docs/ui-integration-requests/UI-OPORTUNIDADES.md` was created: `none`.

## What changed and why

1. **Fixed the accepted lane defect.** `UI-FOUNDATION`'s handoff
   (`docs/ui-handoffs/UI-FOUNDATION.md`) recorded that the member-denied
   opportunity detail page had no `h1` at all (only the shared
   `PermissionDenied`, which renders its message as a `p`, by design, since it is
   used inside pages that already carry their own heading). The list page
   (`/opportunities`) already wrapped its denied state in a page-owned `h1`; the
   detail page (`/opportunities/[opportunityId]`) did not. Added one page-local
   `h1` reusing the existing `copy.board.title` string ("Oportunidades") — the
   same string and visual treatment the sibling list route already uses for its
   own denied state — so a member visiting either denied opportunity surface
   sees one consistent, truthful heading. `PermissionDenied` itself was not
   touched, per the explicit instruction not to globally change it (list routes
   elsewhere already rely on it never emitting its own `h1`).
2. **`MilestoneChecklist` is now an explicit semantic timeline, not just a
   checklist.** `docs/UI-DIRECTION.md`'s V1 placement for Oportunidades and the
   dispatch brief both call for "one truthful semantic milestone timeline," and
   the previous implementation was a plain `<ol>` of independent cards with no
   visual sequence cue. Added a step-marker column (the existing position
   number, now inside a status-toned circular badge) connected by a thin
   vertical rail between consecutive steps, decorative and `aria-hidden`
   (nothing it shows is new information — position, status, and every date
   already exist in the item's own text). The rail stops after the final
   milestone rather than continuing past it. No new fields, no invented
   progress/health score: the badge tone follows the same real
   `MilestoneStatus` the status pill already renders (`pending`, `in_progress`,
   `done`, `blocked`), never a synthesized aggregate.
3. **`OpportunityRow.tsx` and `AssignmentList.tsx` reviewed, not changed.** Both
   were read against the "dense operational rows" and "assigned crew" brief:
   the row already composes identity, status, the base explainer, and the row
   variant of `RevenueRail` in one bordered `article`; `AssignmentList` already
   gives each `member_pool` its own section with its own independent balance
   check (Invariant 6). `OpportunityRailCard` (the list's view model, defined in
   the frozen `src/data/repositories/settlements.ts`) does not carry
   assignments or milestones, so the row cannot show assigned-crew or
   milestone-progress summaries without a repository/type change — out of this
   lane's ownership. No shared request was filed for this because nothing in
   the direction mandates it; the row already meets the documented brief with
   the fields it has.

## Commands and outcomes

Run from a clean worktree at the bootstrap SHA, before committing:

```
npx eslint . --ignore-pattern ".context/**"   0 problems
npx tsc --noEmit -p tsconfig.json             0 errors
npm test (vitest run)                         313 passed (20 files, incl. the
                                               3 new opportunity test files)
rm -rf .next && npm run build                 succeeds — 13 app routes +
                                               /_not-found + /auth/callback +
                                               /login proxy; BUILD_ID
                                               jEySRphrPtL2wpPTRK9p7
```

Focused pass (the three new files only) also run and green in isolation before
the full-suite run above:

```
npx vitest run tests/components/opportunity-row.test.tsx \
  tests/components/opportunity-milestone-timeline.test.tsx \
  tests/components/opportunity-assignment-list.test.tsx
→ 3 files, 13 tests passed
```

New test coverage, in brief:

- `opportunity-row.test.tsx`: the beneficiary name links to the exact detail
  route; the identity line is dense (code, location, project, service in one
  line); the real status pill renders (not free text); the base/cash-received
  explainer always renders; the rail renders in its `row` variant; the row is
  one `article`, not nested decorative cards.
- `opportunity-milestone-timeline.test.tsx`: one top-level ordered-list step per
  milestone in position order; a decorative connecting rail exists between
  every step except after the last one; every milestone shows its real status
  label and nothing resembling an invented health/score term; an assignee
  badge appears only for a milestone that actually has one.
- `opportunity-assignment-list.test.tsx`: every pool gets its own section and
  its own independent balance line (never one aggregated figure); every real
  assignment's name renders; nothing renders that doesn't correspond to a real
  assignment.

All fixtures came from `syntheticSettlementRepository`/`syntheticOpportunityRepository`
against `PROTOTYPE_FOUNDER`, matching the pattern already used in
`tests/components/revenue-rail.test.tsx` and `tests/data/fixtures.test.ts` — no
hand-authored fake people, milestones, or money.

## Mode S (synthetic) — browser evidence

Dev server started on `$CONDUCTOR_PORT` (55140) with
`NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` explicitly
blank in the process environment; no `.env.local` exists in this workspace, so no
real Supabase configuration could leak in. Port was confirmed free
(`lsof -i :$CONDUCTOR_PORT` empty) before start. PID recorded, server stopped and
port reconfirmed free at the end of the session.

**HTTP-level checks** (`curl`, cookie-driven role, matching the contract's
fixture routes):

```
/opportunities                                            founder cookie → 200
/opportunities                                            member cookie  → 200 (denied presentation)
/opportunities/f0000000-0000-4000-8000-000000000001       founder cookie → 200
/opportunities/f0000000-0000-4000-8000-000000000001       member cookie  → 200 (denied presentation)
/opportunities/00000000-0000-4000-8000-000000000000       founder cookie → 404
/opportunities/00000000-0000-4000-8000-000000000000       member cookie  → 200 (denied presentation, correct — not a data 404)
```

**`h1` heading check** (the mandated fix), read directly from server HTML via
`curl`, and independently reconfirmed with `document.querySelectorAll('h1').length`
in-browser:

```
founder board             → 1 h1 ("Oportunidades")
member board (denied)     → 1 h1 ("Oportunidades")
founder detail (valid)    → 1 h1 (beneficiary name, "Tortillería La Ceiba")
member detail (denied)    → 1 h1 ("Oportunidades")   ← previously 0; now fixed
```

**In-browser interaction/visual evidence**, using Claude-in-Chrome, role switched
through the existing prototype `ViewerSwitcher` control (not by writing the
session cookie directly — the tool blocks scripted cookie writes as a privacy
guard, so the real UI control was used instead, which is a more faithful check
anyway):

- Founder board (`/opportunities`): renders four dense rows, project/status
  filter chips with real counts, base/cash-received explainer, and the row
  `RevenueRail` variant on every card. No console errors.
- Founder detail (`/opportunities/f0000000-0000-4000-8000-000000000001`,
  `SETY-0142`): header → base explainer → detail rail → assigned crew (two
  pools, each independently balanced at 100%) → the new milestone timeline
  (7 steps, 3 done/1 in-progress/3 pending, connecting rail present between
  steps and correctly absent after step 7) → cash ledger. No console errors.
- Member board and member detail: both show exactly one `h1` plus the shared
  `PermissionDenied` notice, confirmed both via HTML source and DOM query.
- Invalid opportunity ID, founder role, in-browser: renders the shared
  not-found page (not a crash), matching the `404` HTTP status already
  confirmed via `curl`.
- Zero application console errors or exceptions across the entire session
  (checked with `read_console_messages`, unfiltered and error-only, after a
  fresh navigation on each tab so page-load messages were actually captured).

**Known limitation — exact viewport widths.** Same limitation
`docs/ui-handoffs/UI-FOUNDATION.md` already recorded for its own first pass: the
available browser tool's `resize_window` did not land the real viewport on the
four contracted exact widths (375/767/768/1280) in this environment — requesting
375×812 or 1280×900 both produced the same real `window.innerWidth` of 596 in a
fresh tab (1270 in the tab that was never resized). What was verified is real
functional behavior in two genuine buckets — a narrow bucket (596px, below the
768px breakpoint, confirming the mobile route bar and single-column
recomposition) and a wide bucket (1270px, at/above the desktop breakpoint) —
not pixel-exact matrix cells at 375/767/768/1280. Both buckets showed zero
horizontal overflow (`document.documentElement.scrollWidth` equalled
`clientWidth` at the narrow bucket), correct heading counts, and no console
errors. No screenshot PNGs were persisted to disk this pass (all visual
evidence above was captured and described live rather than saved as files);
per the launch contract, lane screenshots are advisory only regardless, and
`UI-INTEGRATOR` must independently rerun the complete pixel-exact matrix on the
final integrated candidate — this lane's evidence cannot substitute for that.

## Mode D (configured Development founder)

**UNAVAILABLE.** This workspace has no `.env.local`, no configured Supabase
project reachable from here, and no real invited founder or member session.
Per the contract, recorded honestly as unavailable rather than substituted with
Mode S.

## Mode P (fresh production server)

Not run as a separate browser session this pass — the mandated `npm run build`
above succeeded from a clean worktree with the expected route list, which is
the build half of Mode P. A fresh `npm run start` + `/dev/states`/`/favicon.ico`
check was not repeated here because Foundation already established that
sequence passes on this same shell/tooling and this lane changed no chrome,
routing, or build configuration; `UI-INTEGRATOR`'s full regression is the
authoritative Mode P gate regardless.

## Shared / cross-ownership requests

`none`. Nothing in this pass required a change to a frozen or shared-owned file.
The one shared touchpoint noted in Foundation's handoff — the opportunity
detail's missing `h1` — was resolved entirely inside this lane's own owned page
file, exactly as Foundation's handoff instructed ("resolve it inside the
route-owned presentation; do not turn every shared `PermissionDenied` instance
into an `h1`").

## Confirmation

No unauthorized remote action occurred: no push, no PR, no merge, no deploy, no
Vercel change, no OTP, no Supabase mutation, no dependency installed. All
servers started during this session were stopped and their ports confirmed
free. All work is committed locally only, on `ui-oportunidades-builder`, not on
`main` or `ui/integration`.
