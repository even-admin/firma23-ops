# UI-RANKING handoff

## Provenance

- Branch: `ui-ranking-leaderboard-provenance`.
- Bootstrap SHA (base): `d0a9583030159da43014249b205547c77f85c638` — confirmed
  identical to `git merge-base HEAD origin/ui/integration` before any edit, and
  to `git rev-parse HEAD` at session start. This matches the exact SHA this
  lane's builder prompt required as a stop condition.
- Implementation SHA (this lane's only code commit): `934724bf804cd5d5ca243685f43f185320dfc9ba`.
- Worktree was clean (`git status --porcelain=v1` empty) at session start,
  immediately before the Mode P build, and is clean again now with the
  implementation commit as `HEAD`. This handoff file is a separate commit on
  top of it.

## Owned files changed

All within this lane's exclusive ownership per
`docs/UI-WORKSPACE-LAUNCH-PLAN.md` (leaderboard list/provenance pages, new
`src/components/leaderboard/**`, new uniquely named ranking tests, this
handoff):

- `src/app/(network)/leaderboard/page.tsx` (modified)
- `src/app/(network)/leaderboard/[memberSlug]/provenance/page.tsx` (modified)
- `src/components/leaderboard/LeaderboardRankRow.tsx` (new)
- `src/components/leaderboard/ProvenanceEntryRow.tsx` (new)
- `tests/components/leaderboard.test.tsx` (new, uniquely named)
- `docs/ui-handoffs/UI-RANKING.md` (this file)

No types, data, lib, Auth, Supabase, packages, deployment files, shared
components/copy/tests, or other routes were touched.

## What changed and why

Both `/leaderboard` and `/leaderboard/[memberSlug]/provenance` already
existed, fully implemented, from before the lane split (pre-`UI-WORKSPACE-LAUNCH-PLAN.md`
commit `e59f6cf`). They already satisfied the design direction: ranking by
approved earnings only, paid/projected carried as separate context below a
rule, every amount through `Amount`, provenance tracing every centavo to a
named-approver settlement line, no podium theatrics, no XP/tokens/spend/LOC
metrics, no projected rank, no remote avatars, no founder-competition
changes. There was no functional gap to design around.

What the ownership matrix asked for but did not yet exist was
`src/components/leaderboard/**`. This pass extracted the two pages' inline
row markup into that directory with **no markup or behavior change**:

1. `LeaderboardRankRow` — one ranked operator: zero-padded rank, initials,
   name link to `/network/[slug]`, closed/delivered/on-time stats, the
   approved figure (the ranked amount, in the ledger colour), then a
   rule-separated row of paid (neutral ink) and projected (muted, explicitly
   never the ledger colour) plus the "Ver origen" provenance link.
2. `ProvenanceEntryRow` — one traced settlement line: beneficiary link to the
   opportunity, opportunity code/project/role, approver name and date,
   amount, and a paid/approved `RailStateBadge`.

Both route files now map their list/entries arrays to these components
instead of inlining the `<li>` markup. This satisfies the ownership scope and
makes the ranked-figure and provenance-tracing logic independently testable,
without touching any frozen surface (`Amount`, `RailStateBadge`, `EmptyState`,
`copy.leaderboard.*`, the synthetic `leaderboardRepository`, or `views.ts`
types all remain exactly as consumed before).

New test file `tests/components/leaderboard.test.tsx` (18 tests) covers, at
the component level, what the pre-existing `tests/data/leaderboard.test.ts`
(repository level, not owned by this lane, left untouched) does not:

- the approved figure renders as the ranked amount, distinct from paid and
  projected (`$1,794.54` / `$0.00` / `$500.00` from one fixture row);
- projected earnings never render with the ledger `text-money` class (only
  one `text-money` node exists per row — the approved figure);
- rank renders zero-padded, and the profile/provenance links carry the
  correct `href`s;
- a missing on-time rate says so (`copy.network.noRate`) rather than
  inventing a number;
- provenance rows name the approver, link to the source opportunity, and
  badge `paid` vs `approved` correctly by `payoutStatus`.

## Commands and outcomes

```
npm run lint        0 problems
npm run typecheck   0 errors
npm test            307 passed (18 files, including the new leaderboard file)
npm run build       succeeds — same 15 app routes + /_not-found
```

Focused run before the full suite: `npx vitest run tests/components/leaderboard.test.tsx tests/data/leaderboard.test.ts` → 18 passed (18).

### Mode P (fresh production build)

- Preflight: `git status --porcelain=v1` empty at commit `934724b`;
  `$CONDUCTOR_PORT` confirmed free before start.
- `rm -rf .next && npm run build` → success. `.next/BUILD_ID` = `EC1B8B2cu3yeAHNjykxTL`.
- `npm run start -- --port "$CONDUCTOR_PORT"` → launcher PID 59074 (child
  `next-server` PID 59090), started 2026-08-25 01:42:34 CST, URL
  `http://localhost:55160`.
- `GET /dev/states` → `HTTP 404` (mandatory, unauthenticated — passes).
- `GET /favicon.ico` → `HTTP 200`, `content-type: image/x-icon` (passes).
- `GET /leaderboard`, `/leaderboard/sebastian-benitez/provenance`, and
  `/leaderboard/nope/provenance` all returned `HTTP 307` (redirect to
  `/login`) under both founder and member prototype cookies. This is
  correct, expected Mode P behavior, not a defect: the prototype-viewer
  cookie is a Mode-S-only synthetic affordance
  (`isSyntheticModeAllowed()`/`getPrototypeViewer()`), and Mode P has no real
  configured Supabase session to authenticate with here. Per the launch
  contract, the authenticated-route HTTP subset of the dynamic-404 matrix is
  Mode-S territory; Mode P's only mandatory unauthenticated checks
  (`/dev/states` 404, `/favicon.ico` 200) both passed.
- Stopped the launched process (PID 59074/59090); port confirmed free
  afterward.

### Mode S (synthetic), dynamic 404 / role matrix via HTTP

Dev server started fresh on `$CONDUCTOR_PORT` with
`NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`
explicitly blank in the process environment; no `.env.local` exists in this
workspace, so nothing could leak in. Confirmed synthetic mode active (home
renders the synthetic viewer with no login redirect).

```
GET /leaderboard                                    founder cookie -> 200
GET /leaderboard                                    member  cookie -> 200
GET /leaderboard/sebastian-benitez/provenance        founder cookie -> 200
GET /leaderboard/sebastian-benitez/provenance        member  cookie -> 200
GET /leaderboard/nope/provenance                     founder cookie -> 404
GET /leaderboard/nope/provenance                     member  cookie -> 404
```

The invalid-provenance 404 holds for both roles, matching the contract's
`/leaderboard/nope/provenance -> 404` fixture exactly (this route has no
role-gating to complicate the check the way the opportunity route does — the
prior UI-FOUNDATION handoff's note about a no-cookie-defaults-to-member
methodology trap does not apply here since both roles independently 404 on
an unknown slug).

## Mode S browser QA (interactive)

Performed in the connected Chrome browser (`mcp__claude-in-chrome__*`),
against the same Mode S dev server, for both founder and member (switched
live via the in-app `ViewerSwitcher` prototype control, which persists as a
cookie), on `LEADERBOARD`, `PROVENANCE` (`sebastian-benitez` /
`emiliano-pasos`), and the invalid-provenance 404:

- **Ordering and provenance**: leaderboard rows are strictly ordered by
  `APROBADO` descending ($9,294.54 → $6,250.00 → $6,121.59 → $1,794.54 →
  $1,570.22 → …), matching the repository's own sort contract. Opening
  "Ver origen" for Emiliano Pasos shows two settlement lines
  ($1,794.54 + $7,500.00) summing exactly to the row's approved total
  ($9,294.54), each naming "Luis Ramírez" as approver with a date, each
  correctly badged `PAGADO` (fully paid case). Opening Sebastián Benítez's
  provenance shows one line badged `APROBADO` (not paid), consistent with his
  row showing `PAGADO $0.00`.
- **Money semantics**: approved always renders in the ledger colour;
  paid/projected never do (confirmed both visually and via computed
  `className`/`text-money` node count in the new component tests). Approved,
  paid, and projected are visually and structurally distinct on every row
  and on the provenance summary `dl`.
- **Headings**: exactly one `h1` per page, confirmed via
  `document.querySelectorAll('h1')` — `"Ranking"` on the list,
  the member's display name on provenance, `"No encontramos eso"` on the
  invalid-provenance not-found presentation (all three checked in-browser,
  not just by reading the source).
- **No overflow**: `document.documentElement.scrollWidth <=
  document.documentElement.clientWidth` held on every page checked, at both
  achievable real viewports below (no horizontal scroll).
- **Console/network cleanliness**: zero console errors on every route/role
  combination checked (only expected dev-mode HMR/React-DevTools log lines);
  no unexpected network failures observed.
- **Role parity**: both founder and member see the identical ranking and the
  identical provenance detail for the same member, consistent with the
  launch plan ("Operators may see team rank and approved earnings totals ...
  Founders retain access to line-item financial detail" is listed as a
  still-to-validate default, not a current requirement, and the existing,
  frozen repository already serves both roles identically — this lane did
  not change that).
- **No prohibited patterns present**: no podium/medal imagery, no fake
  delta, no XP/tokens/spend/commit/LOC metrics, no projected-rank, no remote
  avatars (initials-only), no invented seasons, no founder-adjudication
  changes. Confirmed by reading every line of both pages and both new
  components, not just by screenshot.

### Known limitation: exact-pixel viewport matrix unavailable

The interactive browser tool's `resize_window` could not be made to land on
the four contracted exact widths (375/767/768/1280) in this environment —
repeated calls with distinct target widths on multiple fresh tabs
non-deterministically settled on whatever size the underlying window already
had (observed real, stable viewports during this session: `757×769` and
`1270×769`), independent of the requested dimensions. This is the same
environment-level limitation `UI-FOUNDATION`'s handoff documents hitting and
names as a known limitation, not something introduced by this lane. Per that
precedent and the launch contract's instruction to record unavailable
evidence honestly rather than substitute it:

- All interaction/visual assertions above were verified at the two real,
  stable viewports this session could actually reach: **`757×769`** (a
  `<768px` mobile-bucket stand-in — the mobile route bar renders, as
  expected below the 768px breakpoint) and **`1270×769`** (a
  `>=768px` desktop-bucket stand-in, 10px narrower than the exact 1280
  target — the desktop sidebar renders, as expected).
  Both buckets, both roles, were exercised.
- This lane changed zero CSS/breakpoint logic: `LeaderboardRankRow` and
  `ProvenanceEntryRow` carry forward the exact same `flex flex-wrap`/`<ul>`/
  `<li>` card classes the inline markup already used, with no new
  `sm:`/`md:`/`lg:` rules and no fixed pixel widths, so there is no new
  breakpoint-specific behavior for the missing exact 375/767/768 cells to
  discover that source review at 757/1270 would not already show.
  Exact-pixel confirmation of this specific pre-existing, unchanged markup
  was already produced by `UI-FOUNDATION`'s later "independent final
  browser-gate repair" pass (96 Mode S cells at exact 375×812/767×900/
  768×900/1280×900, per its handoff) using a different, non-interactive
  harness than the one available to this lane.
- Real Tab-key keyboard traversal also did not reliably move
  `document.activeElement` past `<body>` through this same interactive tool
  in this environment (a separate, adjacent limitation from the viewport
  one). Verified instead: every interactive element this lane added is a
  plain `<a href="...">` with no custom `tabIndex`, no keyboard-event
  handler, and no focus trap — i.e., this lane introduces no new keyboard
  behavior beyond what `UI-FOUNDATION`'s own passed keyboard-focus matrix
  already covers for the shared shell. Mouse-focus was confirmed to
  correctly report `:focus-visible: false` (the click path), consistent
  with proper `:focus-visible`-based ring styling rather than a plain
  `:focus` ring that would incorrectly show on every click.

The final integrated candidate must still rerun the complete exact-pixel
matrix per the launch contract; this lane's evidence remains advisory.

## Mode D (configured Development founder)

**UNAVAILABLE.** Same as `UI-FOUNDATION`: no `.env.local`, no configured
Supabase project reachable from this workspace, and no real invited founder
session exists to use. Honestly recorded as unavailable rather than
substituted with Mode S, per the contract.

## Shared / cross-ownership requests

`none`. No frozen surface needed a change for this lane's work: `Amount`,
`RailStateBadge`, `EmptyState`, `copy.leaderboard.*`/`copy.money.*`, and the
synthetic `leaderboardRepository`/`views.ts` contracts already covered
everything both pages needed.

## Confirmation

No unauthorized remote action occurred: no push, no PR, no merge, no deploy,
no Vercel change, no OTP, no Supabase mutation, no dependency install. All
servers started during this session (one Mode P `next start`, one Mode S
`next dev`) were stopped by this session and their shared port confirmed
free afterward. All work is committed locally only, on
`ui-ranking-leaderboard-provenance`, not on `main` or `ui/integration`.
