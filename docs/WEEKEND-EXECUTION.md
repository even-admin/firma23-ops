# FIRMA23 Ops weekend execution

Deadline: Sunday, 2026-08-23

This is the execution contract for turning the current M1 visual prototype into a
coherent, testable weekend MVP. Luis has authorized autonomous development through
the UI/UX-ready gate: implementation, necessary dependencies, local commits, branch
pushes, pull requests, integration, and additive work against the existing
development Supabase project may proceed without another routine approval.

This authority does not include production deployment, deleting or resetting data,
force-pushing shared branches, exposing credentials, creating a new paid service, or
removing security controls. Those remain hard stop conditions.

## Sunday definition of done

The weekend MVP is done when:

1. A founder can enter the contract command center and start a document-first
   contract intake.
2. The local AI adapter produces a clearly labeled draft from a versioned SETY
   intake fixture, including source evidence, confidence, missing fields, and
   ambiguities.
3. A founder can review the draft contract, opportunities, milestones, suggested
   assignments, and projected allocation before confirmation.
4. An operator cannot access founder-only contract, assignment, or settlement
   controls.
5. Home, Opportunities, Projects, Network, Ranking, and Admin use one frozen set of
   view models and repository interfaces.
6. Projected, approved, paid, and owed money remain technically and visually
   distinct. Approved allocation remains the only source for leaderboard earnings.
7. The application is polished at 375px, 768px, and 1280px with no horizontal
   overflow, visible keyboard focus, and no browser-console errors.
8. `npm run lint && npm run typecheck && npm test && npm run build` passes.
9. Dynamic missing routes return HTTP 404.
10. The README/handoff states exactly what is synthetic, what is implemented but
    unapplied, and what still requires credentials or external approval.

If compatible credentials already exist, the autonomous integrator should wire and
verify development Supabase, private document storage, invite-only authentication,
and a live AI intake adapter. If credentials or provider access are unavailable, it
must finish the complete local implementation with deterministic adapters, mark the
external verification `UNAVAILABLE`, and continue. Missing credentials must not turn
into a question that pauses all other work.

Preview and production deployment remain outside this weekend execution contract.

## Critical starting state

The current visual foundation lives in the `firma23-ops-m1-plan` worktree. It is
ahead of `origin/main` and also has an intentionally dirty visual redesign. A new
Conductor workspace created from `main` will not contain that work.

The first agent must continue in the current workspace, preserve every existing
change, verify the baseline, and create a clean checkpoint before parallel work is
opened. Do not run multiple agents against this same worktree. That agent remains
the autonomous integrator and keeps working until the UI/UX gate is reached; it does
not pause for routine product or implementation questions.

## The UI/UX gate

Luis can begin unrestricted route-level UI/UX work after the Foundation Freeze is
merged. The gate is objective:

- contract, intake, opportunity, assignment, milestone, member-stat, and settlement
  view models are defined;
- repository interfaces return those models without components importing
  `src/data/**`;
- founder/operator permissions and all money states are represented in the models;
- the document-intake state machine and founder confirmation boundary exist;
- all current routes render and the full verification chain passes.

Real Supabase and real AI do not need to be live before this design gate. Their
interfaces do need to be frozen so visual agents are not designing against invented
data.

## Weekend sequence

### Friday: Foundation Freeze

Use one agent in the current workspace. No parallel page agents yet.

Ownership:

- `src/types/**`
- `src/data/**`
- shared repository interfaces
- shared copy required by the new flow
- `/admin` document-intake foundation
- tests for authority, parsing contracts, and money distinctions
- this handoff

Deliverables:

- preserve and checkpoint the current visual work;
- add the smallest document-intake and contract view models;
- add a deterministic local intake adapter and SETY fixture;
- implement the founder review boundary on `/admin`;
- keep manual creation as a fallback, not the primary path;
- run the complete verification chain;
- commit the work in reviewable commits.

The agent may push its feature branch and open a pull request only when Luis includes
that permission in the session prompt. It must not merge, deploy, apply migrations,
or create external resources.

### Saturday morning: Automatic integration gate

The autonomous integrator reviews the Foundation Freeze against repository evidence,
tests, and the running app. It fixes failures and continues without waiting for Luis.

The foundation is accepted when:

- the upload-to-draft-to-review flow makes sense;
- the extracted fields match how FIRMA23 proposals are actually written;
- missing information is visible instead of guessed;
- projected distributions cannot become earnings accidentally;
- founder and operator views are correct.

Once accepted, the integrator may push the feature branch, open a pull request, and
merge it after checks pass. Only then should isolated workspaces start from the
updated `main`.

The integrator is authorized to apply reviewed, additive migrations to the existing
development Supabase project `agsfxtbgwlkcwfyrykfo` when the repository/project ref,
credentials, migration target, and rollback strategy are verified. It may use an
already-configured AI provider credential for bounded development verification. It
must not guess credentials, create a paid provider account, touch another Supabase
project, reset the database, or deploy production.

### Saturday afternoon: Parallel work units

Use separate Conductor workspaces. Every workspace starts from the same merged
Foundation Freeze SHA. Each agent owns only its listed route and local components.

#### WU-A: Backend, Auth, and RLS

Owns `supabase/**`, authorization tests, Supabase repository adapters, and invite-only
authentication wiring. It may prepare everything locally. Applying schema or using
the remote project requires Luis's explicit approval.

#### WU-B: Admin and document intake

Owns `src/app/(network)/admin/**` and `src/components/admin/**`. It turns the frozen
intake contract into the complete command-center experience. It does not change the
domain model, money library, global tokens, or chrome.

#### WU-C: Home and personal work

Owns `src/app/(network)/page.tsx` and `src/components/home/**`. It focuses on approved
earnings, paid/owed distinction, active assignments, next actions, and the member's
recent history.

#### WU-D: Projects and opportunities

Owns `src/app/(network)/projects/**`, `src/app/(network)/opportunities/**`,
`src/components/project/**`, and route-local opportunity presentation. The shared
Revenue Rail may be edited only if this lane is explicitly assigned ownership by the
integrator.

#### WU-E: Network and ranking

Owns `src/app/(network)/network/**`, `src/app/(network)/leaderboard/**`, and their
route-local components. Ranking remains approved-earnings only.

Shared files are frozen during parallel work:

- `src/app/tokens.css`
- `src/app/globals.css`
- `src/components/chrome/**`
- `src/components/money/**`
- `src/lib/money.ts`
- `src/lib/allocation.ts`
- `src/lib/nav.ts`
- `src/types/**`
- `src/data/**`
- `src/copy/es-MX.ts`
- `next.config.ts`

If a lane needs a shared change, it records the request in its handoff instead of
editing the file. The final integrator makes the change once.

### Sunday: Integrate, QA, and stop

Use one integration workspace. Merge/cherry-pick one work unit at a time, run narrow
tests after each, and run the full chain after all lanes are integrated.

Sunday schedule:

- Morning: integrate all green work units and resolve shared requests.
- Early afternoon: visual QA at 375px, 768px, and 1280px; keyboard and permission QA.
- Mid-afternoon: fix P0/P1 issues only.
- Final two hours: full build, dynamic 404 checks, console check, and handoff.

Feature freeze is Sunday at 14:00 local time. After that, do not add chat, realtime,
payments, a public marketplace, new metrics, new roles, or new design-system ideas.
Anything that does not block the Sunday definition of done goes into the follow-up
list.

## Project management for Luis

Luis should not manage engineering while the autonomous integrator is running. His
next required involvement begins at the UI/UX gate.

1. Friday: paste the autonomous prompt into a new session attached to this exact
   workspace, then leave the workspace to that agent alone.
2. When the agent reports `UI/UX READY`, open the preview and begin giving route-level
   visual direction and component references.
3. Sunday: enforce the 14:00 feature freeze and judge the integrated MVP.

For each work unit, require a handoff containing:

- starting SHA and branch;
- exact files owned and changed;
- verification commands and results;
- screenshots or browser observations at required widths;
- unresolved shared-file requests;
- anything synthetic, mocked, unapplied, or credential-blocked;
- commit SHA ready for integration.

## Foundation Freeze prompt

Paste the following into a new agent session attached to the current Jerusalem
workspace, not a newly created workspace:

```text
Continue FIRMA23 Ops in the existing workspace at
/Users/racosta/conductor/workspaces/firma23-ops/jerusalem on branch
firma23-ops-m1-plan.

Read AGENTS.md, every file under docs/, and
.context/next-session-handoff-2026-08-21.md before editing. Then inspect the entire
dirty worktree. All existing modifications and untracked files are intentional and
must be preserved. Do not reset, revert, overwrite, move, or discard them. Do not run
another agent in this worktree.

You are the autonomous weekend integrator. Do not stop after planning or after the
first UI slice. Work continuously through foundation, backend readiness, document
intake, focused tests, full verification, commits, and integration until the product
reaches the objective UI/UX-ready gate. Make conservative product decisions from
existing repository evidence and record assumptions instead of asking routine
questions. Do not pause for Luis unless a hard safety boundary makes further work
impossible; if one external step is blocked, mark it UNAVAILABLE and continue every
other workstream.

Goal: make the engineering and data contracts stable enough that isolated route
design agents can work without changing shared domain logic.

Required work:

1. Verify the inherited M1 baseline and preserve the approved white expanding
   sidebar, mobile route bar, local icon system, dashboard chrome, and animated cyan
   mesh panel.
2. Audit /admin, /projects, /opportunities, member profiles, settlements,
   src/types/views.ts, repository interfaces, schemas, and fixtures.
3. Define the smallest V1 contracts for document intake runs, source files, source
   evidence, extraction confidence, AI contract drafts, draft opportunities,
   milestones, suggested assignments, projected allocation previews, review issues,
   and founder confirmation.
4. Keep the authority boundary explicit: AI output is draft-only. It cannot approve
   contracts, assignments, cash events, settlements, paid status, earnings,
   leaderboard stats, or audit-significant financial changes.
5. Implement a deterministic local intake repository/adapter using versioned SETY
   fixture data. It must be truthful about being synthetic and must not call an
   external AI provider.
6. Implement the first complete /admin Contract Command Center slice:
   - primary action: Subir propuesta
   - document drop/select state
   - processing state
   - extracted draft summary
   - source evidence and confidence
   - missing and ambiguous field review
   - suggested opportunities, milestones, assignments, and projected allocation
   - founder confirmation boundary
   - operator permission-denied state
   - manual creation only as fallback/editor
7. Use actual SETY fixture facts. Do not invent people, clients, financial totals,
   trends, historical series, or completed actions.
8. Add focused tests for schema parsing, permissions, draft authority, projected
   money isolation, and the new UI states.
9. Update docs/WEEKEND-EXECUTION.md and the session handoff if implementation changes
   any stated contract.
10. Prepare the backend foundation needed by the frozen contracts:
   - deterministic migrations for organizations, memberships, profiles, contracts,
     source documents, intake runs/drafts, opportunities, assignments, milestones,
     cash events, allocation-rule versions, settlements, settlement lines, stat
     events, and audit events;
   - integer-centavo and basis-point constraints;
   - RLS on every exposed table with founder/operator tests;
   - invite-only authentication and server-side authorization boundaries;
   - private document-storage ownership/policies;
   - Supabase repository adapters behind the existing interfaces;
   - idempotency and append-only settlement/stat/audit behavior.
11. If the existing development Supabase credentials are available and the exact
    project ref is `agsfxtbgwlkcwfyrykfo`, review and apply additive migrations, seed
    development data, and verify RLS with founder/operator identities. Never touch a
    different project. Never reset or delete existing data.
12. Implement an AI intake provider boundary. Use an existing configured development
    credential if available; otherwise keep the deterministic local adapter active
    and report live-provider verification as UNAVAILABLE. AI output remains draft-only
    in both cases.
13. Continue until all current routes consume stable repository/view-model contracts
    and the full verification gate is green. Then report `UI/UX READY` and list the
    exact files frozen for route-design agents.

Non-negotiable invariants:

- Money is integer centavos and every rendered amount uses Amount.
- Projected money is never approved, earned, payable, paid, or ranked money.
- Projected subtrees contain zero money classes.
- Ledger green is reserved for confirmed money and primary completion.
- Components do not import src/data/**.
- Financial rules remain versioned fixture/repository data, never components.
- No hardcoded hex outside src/app/tokens.css.
- No loading.tsx above dynamic routes.
- Preserve agentRules:false in next.config.ts.
- Add only dependencies that are necessary for the required Supabase, document, or
  AI boundary and are compatible with the existing stack. Do not run shadcn init and
  do not replace the established token, font, or icon systems.
- Development Supabase work is allowed only against verified project
  `agsfxtbgwlkcwfyrykfo` and only through reviewed additive migrations. No reset,
  destructive migration, production project, Vercel, or deployment.
- Never print, commit, expose, or copy credentials into client code.

Before handoff run:
npm run lint && npm run typecheck && npm test && npm run build

Also verify the running app at 375px, 768px, and 1280px; no horizontal overflow;
visible keyboard focus; active route state; sidebar collapse/expand; mobile active
label; founder/operator permissions; projected versus approved money; dynamic 404
status codes; and no browser-console errors.

You may create local commits, push the feature branch, open a pull request, and merge
after all required checks pass. You may apply reviewed additive migrations to the
verified development Supabase project. Do not deploy, reset/delete data, force-push,
touch production, create a new paid service, or expose credentials. End with: `UI/UX
READY`, merge and commit SHAs, changed-file summary, exact verification results,
browser observations, development-backend evidence, anything marked UNAVAILABLE,
shared contracts now frozen, and the exact base SHA future isolated workspaces must
use.
```

## Final integration rule

Green tests in an isolated workspace are candidate evidence, not an integrated MVP.
The Sunday completion claim belongs only to the final integrated branch after the
full route, permission, money, responsive, 404, and console checks pass together.
