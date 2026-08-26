# FIRMA23 UI workspace launch contract

Status: HOLD until this tracked contract passes read-only review.

This document is the cross-workspace authority for the UI program. An ignored
`.context` file, chat transcript, screenshot path, or remembered instruction does
not override it.

For this UI program, this contract supersedes older workflow permissions in
`docs/WEEKEND-EXECUTION.md` wherever they conflict. In particular, historical
authority for routine branch pushes or integration does not authorize the Vercel
Preview deployments now coupled to those actions. Product, money, Auth, RLS, and
backend invariants in the other documents remain binding.

## Exact authority and bootstrap

- Canonical repository: `even-admin/firma23-ops`.
- Plan base: `origin/main` at
  `67bac0a5c0949c0f1c2d11de20c8a2af33959d7d`.
- The reviewed plan commit on `ui-launch-contract` becomes the bootstrap SHA.
- Foundation must be created from that exact tracked bootstrap SHA, not from a
  moving `main` and not from an ignored local file.
- Every workspace prints `git branch --show-current`, `git rev-parse HEAD`,
  `git status --porcelain=v1`, and its merge base before editing.
- A changed base SHA, branch head, Preview SHA, deployment URL, build ID, or role
  invalidates evidence collected for an earlier candidate.
- Production is unverified and has documented legacy environment coupling. UI
  work must not depend on or mutate Production.

The plan branch remains local until Luis separately authorizes its push and the
automatic Vercel Preview that push can cause. No authorization from PR #7 carries
forward to this UI program.

## Branch and deployment sequence

Merging `main` can automatically deploy Production. No Foundation or route branch
is merged to `main` during construction.

1. Review this tracked plan on `ui-launch-contract`.
2. With a new explicit Preview authorization, push the reviewed plan branch.
3. Create `UI-FOUNDATION` from the exact remote plan SHA.
4. Implement, verify, and independently review Foundation locally.
5. With a new explicit Preview authorization, push the reviewed Foundation branch.
6. Before route workspaces or route PRs exist, create remote branch
   `ui/integration` at the exact reviewed Foundation SHA. Verify it with
   `git ls-remote` and record the SHA. Creating or updating that branch also needs
   explicit Preview authorization.
7. Create all six route workspaces from that exact `ui/integration` SHA.
8. Route branches may be pushed and opened as PRs targeting `ui/integration` only
   after a bounded authorization covering their Preview deployments.
9. `UI-INTEGRATOR` processes each accepted route PR/commit and shared request on
   `ui/integration`, then runs the authoritative global regression on one exact
   candidate SHA.
10. Open one final UI PR from `ui/integration` to `main`.
11. HOLD the final merge until one of these mutually exclusive gates is met:
    - Luis explicitly authorizes the resulting Production deployment after a
      read-only environment, rollback, and release preflight; or
    - Luis explicitly authorizes a reviewed Git deployment-policy change that
      prevents the merge from deploying Production, and the policy is verified
      before merge.

Neither a green Preview nor a mergeable PR authorizes a merge. No UI agent may
change Vercel settings, add deployment-suppression configuration, merge, deploy,
apply migrations, send OTP, create identities, or touch Supabase without a
separate explicit grant.

## Durable lane handoffs

Every lane, including Foundation and Integrator, creates one unique tracked file
even when it has no shared request:

- `docs/ui-handoffs/UI-FOUNDATION.md`
- `docs/ui-handoffs/UI-INICIO.md`
- `docs/ui-handoffs/UI-OPORTUNIDADES.md`
- `docs/ui-handoffs/UI-RED.md`
- `docs/ui-handoffs/UI-RANKING.md`
- `docs/ui-handoffs/UI-PROYECTOS.md`
- `docs/ui-handoffs/UI-ADMIN.md`
- `docs/ui-handoffs/UI-INTEGRATOR.md`

Each handoff records:

- base SHA, head SHA, branch, merge base, and clean/dirty status;
- exact owned and changed files;
- commands and outcomes;
- server provenance and route/mode/role/viewport matrix results;
- unavailable or user-action-required evidence;
- anything synthetic, configured, remote, or unverified;
- shared requests, with the literal value `none` when there are none;
- local screenshot filenames as advisory observations only;
- confirmation that no unauthorized remote action occurred.

If a route lane needs a frozen/shared change, it also creates exactly one tracked
file: `docs/ui-integration-requests/<lane>.md`. That request states current
behavior, requested contract, affected routes, acceptance evidence, whether the
lane is blocked, and any money/permission impact. Route agents never make the
requested shared edit themselves. Integrator resolves each request as accepted,
superseded, or rejected and records the resolution in its handoff.

Lane screenshots remain local, disposable aids. They are not final acceptance
evidence and do not need to cross workspaces. `UI-INTEGRATOR` is the sole authority
for browser acceptance and must freshly rerun the complete matrix on the final
integrated SHA. A route lane's screenshot or claim can never substitute for that
revalidation.

## Ownership matrix

### Foundation-only ownership

Foundation may edit these files. After its reviewed SHA, they are frozen for all
route lanes and editable only by Integrator in response to a tracked request.

- `src/app/tokens.css`
- `src/app/globals.css`
- `src/app/(network)/layout.tsx`
- `src/components/chrome/**`
- `src/components/visual/MeshDriftCanvas.tsx`
- new, uniquely named Foundation tests
- `docs/DESIGN-DIRECTION.md` and `docs/M1-HANDOFF.md`, only to reconcile the
  MeshDrift exception below
- `docs/ui-handoffs/UI-FOUNDATION.md`

### Shared surfaces owned by Integrator

Foundation and route lanes consume but do not edit these. Integrator changes them
only in response to a tracked request or a cross-route regression:

- `src/components/money/**`
- `src/components/revenue-rail/**`
- `src/components/state/**`
- `src/components/filter/**`
- `src/components/finance/**`
- `src/components/metrics/**`
- `src/components/operator/AssignmentRow.tsx`
- `src/components/opportunity/StatusPill.tsx`
- `src/copy/es-MX.ts`
- `src/app/dev/states/page.tsx`
- `tests/components/chrome.test.tsx`
- `tests/components/revenue-rail.test.tsx`
- `tests/components/surfaces.test.tsx`
- any existing test file consumed by more than one lane
- `next.config.ts`

### Product/backend contracts frozen for every UI lane

- `src/types/**`
- `src/data/**`
- `src/lib/**`, except a Foundation-owned chrome helper only when independently
  reviewed before editing
- `src/app/(network)/admin/intake-actions.ts`
- Auth routes, actions, proxy, and session resolution
- `supabase/**`
- package manifests and lockfiles
- `.conductor/**`
- repository and deployment configuration

`intake-actions.ts` is an authenticated backend boundary. UI-ADMIN may consume its
existing actions through presentation components but may not edit the file, alter
its inputs/outputs, bypass viewer resolution, replace repository calls, or invent a
client-only success path.

### Exclusive route ownership

| Lane | Exclusive tracked ownership |
| --- | --- |
| `UI-INICIO` | `src/app/(network)/page.tsx`; new `src/components/dashboard/**`; new uniquely named Inicio tests; its handoff/request files |
| `UI-OPORTUNIDADES` | opportunity list/detail pages; `OpportunityRow.tsx`, `AssignmentList.tsx`, `MilestoneChecklist.tsx`; new uniquely named opportunity tests; its handoff/request files |
| `UI-RED` | network list/profile pages; `OperatorCard.tsx`, `AvailabilityBadge.tsx`, `SkillChips.tsx`, `StatGrid.tsx`; new uniquely named network tests; its handoff/request files |
| `UI-RANKING` | leaderboard list/provenance pages; new `src/components/leaderboard/**`; new uniquely named ranking tests; its handoff/request files |
| `UI-PROYECTOS` | project list/detail pages; new `src/components/project/**`; new uniquely named project tests; its handoff/request files |
| `UI-ADMIN` | admin page files excluding `intake-actions.ts`; `src/components/admin/**` as presentation only; new uniquely named admin tests; its handoff/request files |

`AssignmentRow`, `StatusPill`, `RevenueRail`, `FilterChips`, state components,
finance/metric components, centralized copy, backend actions, and shared tests are
intentionally excluded from route ownership even when a route imports them.

## Sidebar interaction contract

Foundation implements and tests one desktop model:

- At `>=768px`, saved mode is `compact` or `hidden`.
- First visit defaults to `compact` at 92px.
- Compact expands transiently to 292px while hovered or while keyboard focus is
  inside the sidebar.
- Hover/focus expansion never changes or persists the saved mode.
- TopBar toggles `compact` and `hidden` and persists that preference across reloads
  in local browser storage.
- Returning from `hidden` restores `compact`, never transient expanded width.
- There is no pinned-expanded mode in this milestone.
- At `<768px`, desktop sidebar is absent and inert; the mobile route bar is
  authoritative. Saved desktop preference remains but has no mobile layout effect.
- Active rows retain a complete background/border shape in compact and expanded
  presentation. Glyph, avatar, and active-state centers share one axis.
- Focus entering the sidebar expands it before labels are needed and keeps it
  expanded until focus leaves.
- Reduced motion removes width/label animation while preserving final state and
  visible focus.

If local storage is unavailable, fail to `compact` without a render crash or
hydration mismatch.

## Approved bounded gradient exceptions

The original Foundation contract admitted only the Home environment. The later
approved studio-direction pass narrows the current rule to three bounded uses:

- no unbounded color washes, rainbow metrics, or additional gradient components;
- animated `MeshDriftCanvas` is the Home environment;
- `IdentityOrb` identifies members and `ProjectCover` identifies projects;
- preserve its approved palette, speed, grain, reduced-motion static frame, and
  honest WebGL fallback.

Route lanes may not add other gradients. The current authority is
`docs/UI-DIRECTION.md` and `docs/DESIGN-DIRECTION.md`.

## Exact fixture routes

These constants are the only fixture routes used by the shared acceptance matrix:

| Name | Exact route | Expected fixture |
| --- | --- | --- |
| `HOME` | `/` | role-specific home |
| `OPPORTUNITIES` | `/opportunities` | founder board/member denied |
| `OPPORTUNITY` | `/opportunities/f0000000-0000-4000-8000-000000000001` | `SETY-0142`, projected/in delivery |
| `NETWORK` | `/network` | six synthetic operators |
| `MEMBER` | `/network/sebastian-benitez` | synthetic member profile |
| `LEADERBOARD` | `/leaderboard` | approved-earnings ranking |
| `PROVENANCE` | `/leaderboard/sebastian-benitez/provenance` | approved provenance |
| `PROJECTS` | `/projects` | three projects |
| `PROJECT` | `/projects/sety-2026` | SETY detail |
| `ADMIN` | `/admin` | founder command center/member denied |
| `FINANCE` | `/admin/finance` | founder finance/member denied |
| `SETTLE` | `/admin/finance/f0000000-0000-4000-8000-000000000001/settle` | SETY-0142 settlement preview |

Invalid dynamic routes and required HTTP result:

- `/projects/nope` -> 404
- `/opportunities/00000000-0000-4000-8000-000000000000` -> 404
- `/network/nope` -> 404
- `/leaderboard/nope/provenance` -> 404

Do not replace these with a different convenient fixture without updating this
tracked contract and reviewing the change.

## QA modes

Evidence from one mode cannot be used to claim another.

### Mode S: synthetic presentation

- Start development server on exact `$CONDUCTOR_PORT` with
  `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` explicitly blank in the process
  environment. Do not edit or delete `.env.local`.
- Confirm local synthetic mode is active before testing.
- Exercise synthetic founder and member presentation.
- This proves composition only, never RLS, real Auth, real membership, or remote
  data access.

### Mode D: configured Development founder

- Start a separate fresh development server on exact `$CONDUCTOR_PORT` with copied
  canonical Development public Supabase configuration.
- Use only the real invited founder and an existing legitimate browser session.
- Never create an identity, send OTP, rotate SMTP, or alter remote Auth for UI QA.
- If no legitimate session exists, record `USER_ACTION_REQUIRED` or `UNAVAILABLE`;
  do not substitute Mode S.
- No real operator/member identity exists. Do not claim real member or member-RLS
  browser acceptance. Member presentation is Mode S only.

### Mode P: fresh production server

- Require clean tracked worktree before build.
- Record candidate `HEAD`.
- Remove only generated `.next`, then run `npm run build` from that exact SHA.
- Record `.next/BUILD_ID` immediately after build.
- Fail preflight if `$CONDUCTOR_PORT` is unset or occupied; never kill an unknown
  process on the port.
- Start `npm run start -- --port "$CONDUCTOR_PORT"` as a fresh process and record
  PID, command, start time, URL, HEAD, and BUILD_ID.
- Verify `/dev/states` returns HTTP 404 and `/favicon.ico` returns HTTP 200 with the
  expected image content type.
- Stop only the process launched by this QA pass and confirm the port is free.

A dev server, old process, old `.next`, or unrecorded BUILD_ID cannot satisfy Mode P.

## Required route x mode x role x viewport matrix

Use a stable recorded height. Widths are exact pixels.

### Mode S founder

At each width `375`, `767`, `768`, and `1280`, test all twelve fixture routes:

`HOME`, `OPPORTUNITIES`, `OPPORTUNITY`, `NETWORK`, `MEMBER`, `LEADERBOARD`,
`PROVENANCE`, `PROJECTS`, `PROJECT`, `ADMIN`, `FINANCE`, `SETTLE`.

### Mode S member

At each width `375`, `767`, `768`, and `1280`:

- test allowed routes `HOME`, `NETWORK`, `MEMBER`, `LEADERBOARD`, `PROVENANCE`,
  `PROJECTS`, and `PROJECT`;
- test denied presentation on `OPPORTUNITIES`, `OPPORTUNITY`, `ADMIN`, `FINANCE`,
  and `SETTLE`.

### Mode D founder

At widths `375`, `768`, and `1280`, test:

`HOME`, `OPPORTUNITIES`, `OPPORTUNITY`, `NETWORK`, `LEADERBOARD`, `PROJECTS`,
`ADMIN`, and `SETTLE`.

Mode D may be explicitly unavailable under the session rule above. No Mode D member
row exists until a separately authorized real invite exists.

### Dynamic 404 matrix

In Mode S founder at `1280`, verify every invalid route both in-browser and with an
HTTP client. Each HTTP response must be 404, not merely a rendered not-found page.
Repeat the HTTP check against Mode P only when a valid configured founder session
can be supplied without changing Auth; otherwise record that production-authenticated
subset as unavailable. Mode P `/dev/states` 404 remains mandatory and unauthenticated.

## Interaction and visual assertions

For every applicable matrix cell:

- read back the actual browser viewport after resize;
- no horizontal overflow;
- shell/content borders align and fixed chrome never overlaps content;
- active route state is correct;
- desktop compact, hover expansion, focus expansion, persisted hidden/compact,
  reload restoration, and absence of pinned-expanded mode match the contract;
- mobile active-label transition and content clearance work;
- every interactive control has visible keyboard focus;
- skip link becomes visible, focuses `#main-content`, and bypasses chrome;
- command palette traps focus, makes background controls unreachable, closes on
  Escape, and restores focus to the exact opener;
- dialogs/popovers close predictably and leave no hidden control tabbable;
- `prefers-reduced-motion: reduce` removes nonessential transitions and freezes
  MeshDrift after its allowed frame without blanking it;
- console has zero application errors;
- projected subtrees contain zero `money` classes;
- approved and paid remain distinct;
- every displayed amount still renders through `Amount`;
- exactly one `h1` exists and heading levels do not skip.

Screenshot filename:

`<lane>-<mode>-<role>-<route-slug>-<width>x<height>-<state>.png`

Screenshots live under `.context/qa/<lane>/<head-sha>/` and are advisory only. Each
lane lists filenames/results in its tracked handoff. Integrator must recapture and
revalidate from the integrated candidate; inaccessible lane images never count as
final evidence.

## Server provenance for every browser run

Before labeling any evidence with a candidate SHA, record in the lane handoff:

- `git rev-parse HEAD`;
- `git status --porcelain=v1` before build/start and after QA;
- exact server mode and environment classification;
- exact `$CONDUCTOR_PORT` and URL;
- proof the port was free before start;
- launched PID and command;
- server start timestamp;
- `.next/BUILD_ID` for Mode P;
- route response observed only after that fresh server reported ready;
- process stop and port-free confirmation.

If the worktree changes, the server predates the candidate, or provenance is
missing, discard the evidence and restart from a clean fresh server.

## UI-FOUNDATION builder prompt

You are the FIRMA23 UI Foundation designer-builder. Work autonomously in a new,
isolated Conductor workspace created from the exact reviewed remote SHA containing
`docs/UI-WORKSPACE-LAUNCH-PLAN.md`. Before editing, read `AGENTS.md`, every file in
`docs/`, and this contract. Print branch, HEAD, merge base, and clean status. Stop
if the SHA differs from the reviewed bootstrap SHA stated in the handoff.

Implement only Foundation ownership and the sidebar contract. Preserve paper-white
field, compact black structure, Geist, borders-only depth, 4px spacing, 44px
controls, causal motion, and mobile recomposition. Follow the bounded gradient
exceptions in `docs/UI-DIRECTION.md`. Do not add other gradients, shadows,
dependencies, fake data, foreign icons, or branding.

Primary work:

- make compact/transient-expanded sidebar states one finished object;
- align glyphs, avatars, labels, active shapes, shell borders, and content axes;
- implement exact compact/hidden persistence and reduced-motion behavior;
- refine TopBar, skip-link, and command-palette accessibility;
- preserve the floating mobile route bar without overlap or overflow;
- update `docs/DESIGN-DIRECTION.md` with the narrow MeshDrift exception;
- create the mandatory tracked Foundation handoff.

Do not edit route pages, route-specific components, Integrator-owned shared
surfaces, copy, product/backend contracts, Auth, Supabase, packages, actions, or
deployment configuration. If a shared edit is required, create the tracked request
and stop rather than crossing ownership.

Run lint, typecheck, tests, build, and the exact browser/provenance contract. Mode D
may be honestly unavailable but never substituted. Commit locally only. Do not
push, open PR, merge, deploy, change Vercel, send OTP, or touch Supabase. Return
exact SHA, files, commands, tracked handoff, matrix results, advisory screenshot
paths, unavailable cases, and requests.

## Route-lane rules

After Foundation is reviewed, pushed with explicit Preview authorization, and
remote `ui/integration` is verified at its exact SHA, create all routes from that
same SHA. Every route lane:

- edits only exclusive ownership;
- creates its mandatory tracked handoff, even with no request;
- consumes existing repositories and view models;
- never imports `src/data/**` from components;
- creates no fake people, metrics, money, routes, or console actions;
- keeps projected, approved, and paid semantics distinct;
- renders every amount with `Amount` and ranking from approved earnings only;
- writes shared requests to its unique tracked request file;
- commits locally and performs no remote action without a new explicit grant;
- runs focused tests plus lint, typecheck, build, and route browser evidence at
  `375`, `767`, `768`, and `1280`.

## Final integration gate

Integrator owns conflict resolution, accepted shared requests, shared surfaces,
centralized copy, shared tests, and the fresh full regression. It may not alter
product/backend contracts to make UI tests pass.

The exact integrated candidate must pass:

- clean-worktree preflight and server provenance;
- lint;
- typecheck;
- all unit tests;
- fresh production build and Mode P;
- `scripts/db-verify.sh` because database contracts remain in the repository;
- complete Mode S matrix;
- available Mode D founder matrix with honest unavailable cells;
- dynamic 404 matrix;
- all interaction/visual assertions;
- adversarial review at the exact candidate SHA;
- explicit Production or deployment-policy gate before final merge.

Only the tracked `UI-INTEGRATOR` handoff and a fresh independent review of its exact
candidate SHA can claim final browser acceptance. Only then is the final UI PR
eligible for a separate merge decision.
