# UI-INTEGRATOR handoff

## Preflight

- Base / bootstrap SHA: `d0a9583030159da43014249b205547c77f85c638` (`docs(ui): establish FIRMA23 visual direction`).
- Branch at start: `ui-integrator-merge-six-lanes`.
- `git rev-parse HEAD` at start: `d0a9583030159da43014249b205547c77f85c638`.
- `git rev-parse origin/ui/integration` at start: `d0a9583030159da43014249b205547c77f85c638`.
- `git merge-base HEAD origin/ui/integration` at start: `d0a9583030159da43014249b205547c77f85c638`.
- `git status --porcelain=v1` at start: empty (clean).
- All eleven required lane commit SHAs verified present as `commit` objects (`git cat-file -t`) before any cherry-pick.

All three values matched exactly, so integration proceeded per instructions.

## Lane cherry-picks, in the required risk-ascending order

Every lane commit was cherry-picked individually (no squashing) with `git cherry-pick`, one at a time, in this exact sequence. Every pick applied cleanly — zero conflicts, zero missing objects.

| Order | Lane | Source commit | Resulting commit |
| --- | --- | --- | --- |
| 1 | UI-INICIO | `6dfb1277e91e734d0629875c4ba409f6b2d30f00` | `2bb586c` |
| 1 | UI-INICIO | `d73a162c33c16eff35fe57497a21ec8e93d13cdc` | `54d507e` |
| 2 | UI-RED | `f3b7148b771e37f1b594f0ec171daa46c8826187` | `795fd02` |
| 2 | UI-RED | `69dd8958a29da8e985c40c4d6d71ee4910ed52e3` | `09d62ae` |
| 3 | UI-RANKING | `934724bf804cd5d5ca243685f43f185320dfc9ba` | `d12c808` |
| 3 | UI-RANKING | `35ac8cd3ff1b9121a9f024a7e707da7a3716cbd9` | `c7f2730` |
| 4 | UI-OPORTUNIDADES | `89ee8dd349904065ab79033206beae7d302bfd0c` | `ec76238` |
| 5 | UI-ADMIN | `36a73529d6aa7bde3fbd255690eedc6b8d69654b` | `f665620` |
| 5 | UI-ADMIN | `44dd6c9574ef90d483d659f61be0acadf8bd5b5f` | `a8ccd42` |
| 6 | UI-PROYECTOS | `4b6b717923a4a699a6c3cf57e323c531d1cfdfb4` | `f8c7e30` |
| 6 | UI-PROYECTOS (repair) | `210ec75c412777a3ca6b7efc2204c58629957026` | `832dadd` |

Full unit-test suite passed after all six lanes were in place, before any Integrator correction (`npx vitest run` over the nine new/changed lane test files: 9 files, 49 tests passed).

## Integrator-owned shared corrections

Four separate commits, one per correction, so each decision is independently reviewable/revertable.

### A — 44px interactive-target floor (`2f128ed`)

Searched the entire integrated tree for `md:min-h-0` (`grep -rn "md:min-h-0" src/ tests/`) and found 13 occurrences across 12 files, contributed by five different lanes. Read the surrounding JSX for every occurrence before touching it. All 13 sat on genuinely interactive elements — `<Link>`, `<a>`, one `<button>`, one `<summary>` — each already carrying `min-h-11` (44px) that the `md:` override dropped back to `min-h-0` at `>=768px`, i.e. exactly the touch-device regression the tracked target contract forbids. Removed ` md:min-h-0` from all 13; left the two unrelated plain `min-h-0` occurrences in `src/components/chrome/Sidebar.tsx` untouched (non-interactive flex/scroll containers, not a responsive override, not part of this ownership).

Files touched: `src/app/(network)/opportunities/[opportunityId]/page.tsx`, `src/app/(network)/projects/[projectSlug]/page.tsx`, `src/app/(network)/network/[memberSlug]/page.tsx`, `src/components/admin/ConfirmContractControl.tsx`, `src/components/leaderboard/LeaderboardRankRow.tsx` (2 occurrences), `src/components/leaderboard/ProvenanceEntryRow.tsx`, `src/app/(network)/admin/finance/page.tsx`, `src/components/opportunity/OpportunityRow.tsx`, `src/app/(network)/admin/page.tsx`, `src/components/admin/ContractDraftSummary.tsx`, `src/components/opportunity/MilestoneChecklist.tsx`, `src/components/operator/OperatorCard.tsx`.

### B — Admin intake-stepper copy (`57c81f3`)

Read `docs/ui-integration-requests/UI-ADMIN.md` in full. UI-ADMIN could not edit the Integrator-owned `src/copy/es-MX.ts`, so it shipped the four intake-phase labels and the stepper's `aria-label` as local constants in `IntakeStepper.tsx`, with a tracked request to centralize them. Added exactly the requested block, exact approved strings, no invented copy:

```ts
stepper: {
  ariaLabel: 'Progreso de la propuesta',
  document: 'Documento',
  extraction: 'Extracción',
  review: 'Revisión',
  confirmation: 'Confirmación',
},
```

nested under `copy.admin.intake.stepper` in `src/copy/es-MX.ts`. Switched `src/components/admin/IntakeStepper.tsx`'s `STEP_LABELS` and the `<ol aria-label>` to consume `copy.admin.intake.stepper` instead of its local constants; removed the now-dead local constants and their comment. `tests/components/admin-intake-stepper.test.tsx` (8 tests) still passes unmodified — it asserts on the rendered Spanish text, which is unchanged.

Request resolution: **accepted**.

### C — Cross-namespace copy cleanup (`b834030`)

Found exactly the two reuses named in the brief:

- `src/components/project/ProjectRecordTable.tsx` (Proyectos-owned) rendered `copy.board.filterProject` / `copy.board.filterStatus` (Oportunidades-owned). Added `copy.projects.filterProject: 'Proyecto'` and `copy.projects.filterStatus: 'Estado'` (identical visible Spanish) and repointed the two `<th>` labels. `copy.board.filterProject/filterStatus` is untouched and still used by `src/app/(network)/opportunities/page.tsx`, which legitimately owns it.
- `src/components/operator/OperatorCard.tsx` (Red-owned) rendered `copy.home.activeWork` (Inicio-owned). Added `copy.network.activeWork: 'Trabajo activo'` (identical visible Spanish), repointed the one usage, and removed the now-unused `copy.home.activeWork` key from the `home` namespace (nothing else referenced it — confirmed with a repo-wide grep after the move). Updated `tests/components/red-operator-identity.test.tsx`'s two assertions to read `copy.network.activeWork` instead of `copy.home.activeWork`; both tests still assert the same rendered string.

No product language was rewritten; both moves are byte-for-byte the same Spanish text under a new key.

### D — Red h1 scale vs. sibling detail routes (`262db24`)

Every other page-subject `<h1>` on a detail/profile route (`ProjectHeader.tsx`, the opportunity-detail page, the leaderboard-provenance page) renders at `text-3xl sm:text-4xl`. Red's member-profile hero (`OperatorCard` with `headingLevel="h1"`, per `docs/ui-handoffs/UI-RED.md` item 1) shipped one step smaller, at `text-2xl sm:text-3xl` — UI-RED's own handoff explains this was sized relative to the *directory-card* `h2` (`text-lg`), not against sibling detail pages. That is a visible inconsistency with the tracked Player-mode hierarchy: a member's own profile page reads smaller than every other page-subject heading in the app. Normalized `isHero` to `text-3xl sm:text-4xl` to match; the dense `h2` directory-card scale (`text-lg`) is unchanged. `tests/components/red-operator-identity.test.tsx` makes no assertion on the literal class, so it required no further change beyond C's key rename.

### E — Scope discipline

No `ProcessTimeline`, universal KPI cards, menus, alerts, view-models, repository contracts, `src/data/**`, AI, compute, or finance changes were made, and no dependency was added or upgraded. Confirmed with `git diff --stat d0a9583..HEAD` — the full 43-file, 3132(+)/332(-) diff touches only route-owned files, the shared copy file, and 12 files for correction A, all consistent with the ownership matrix in `docs/UI-WORKSPACE-LAUNCH-PLAN.md`.

## Verification

### Lint / typecheck / unit tests / build

Run at the final HEAD (`b834030`), clean worktree before and after each:

- `npm run lint` — clean, zero warnings/errors.
- `npm run typecheck` (`tsc --noEmit`) — clean.
- `npx vitest run` — **26 test files, 349 tests, all passed** (includes every lane's focused tests plus all pre-existing shared/chrome/revenue-rail/surfaces tests).
- `npm run build` (fresh `next build`, Turbopack) — compiled successfully; 15 routes emitted (9 dynamic, 6 static), zero build errors.

### `scripts/db-verify.sh`

Local Postgres tooling (`initdb`, `pg_ctl`, `psql` — Homebrew `postgresql@17`) was available on `PATH`, so the full harness ran rather than being recorded unavailable.

Result: **153 passed, 0 failed** across all 20+ scenarios (RLS/RPC auth boundaries, idempotency, 20-way and 10-round concurrency races, exact-reversal/audit atomicity, `redeem_invite()` state machine including the concurrent-fallback and 20-way concurrent-first-redemption scenarios). The harness's own `trap cleanup` tore down its disposable Postgres instance and temp dir on exit; confirmed no `postgres`/`pg_ctl` process and no leftover `/tmp/firma23-db-verify.*` directory remained afterward.

### Mode P (fresh production server)

- Preflight: worktree clean, `HEAD=b834030`, `$CONDUCTOR_PORT` (55190) confirmed free via `lsof` before start.
- Removed `.next`, ran `npm run build` from that exact SHA.
- `BUILD_ID`: `XYtfivkaPYvvbZP5naKD7`.
- Started `npm run start -- --port 55190` as a fresh process (npm PID 10327, `next-server` child PID 10344), recorded start time `2026-08-25T18:50:49Z`.
- `GET /dev/states` → **HTTP 404**.
- `GET /favicon.ico` → **HTTP 200**, `content-type: image/x-icon`.
- All twelve fixture routes and all four invalid routes returned **HTTP 307** (redirect to `/login`) when requested unauthenticated via `curl` — expected and correct: no `NEXT_PUBLIC_SUPABASE_*` vars are set anywhere in this workspace (no `.env.local` exists) and `isSyntheticModeAllowed()` is `false` under `next start` (`NODE_ENV=production`), so `resolveViewerSessionStateUncached()` correctly returns `backend-unavailable` → redirect, per `src/data/viewer-session.ts`'s H1 fix (never fail open to a synthetic/founder viewer on a production-mode server missing Supabase config).
- Stopped the exact launched process (`kill 10327`); confirmed no `next-server`/`next dev` process remained and the port was free.

The authenticated-founder subset of the Mode-P dynamic-404 recheck (the contract's optional "repeat against Mode P only when a valid configured founder session can be supplied without changing Auth") is **UNAVAILABLE**: no Development/Production Supabase session can be supplied without creating an identity or sending OTP, both out of scope here. This is the same unavailability as Mode D below, not a separate gap.

### Mode S (synthetic presentation) — full matrix

Server: fresh `next dev --port 55190`, `NEXT_PUBLIC_SUPABASE_URL=""` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""` explicitly set empty in the process environment (redundant with the absence of `.env.local`, set explicitly anyway per instruction), confirmed ready in server log, confirmed synthetic mode active (founder cookie renders `/admin`'s founder copy; no cookie renders member-denied copy on the same route). PID 12625 (npm) / 12676 (`next-server`), started `2026-08-25T18:52Z` (from server log timestamp), port confirmed free before start and after stop.

Browser automation: the existing local Playwright + Chromium installation at `/Users/racosta/klokk/node_modules/playwright` (Chromium `1228`, already downloaded — no install performed; Conductor viewport resize was not used).

**Founder — all 12 fixture routes × 4 widths (375, 767, 768, 1280) = 48 cells:**

- HTTP status: 200 for all 48.
- Actual measured `window.innerWidth` matched the requested width for all 48 (exact per-cell values recorded in `/tmp/matrix-report.json` during the run; not copied into the repo).
- Horizontal overflow (`scrollWidth > clientWidth`): **zero** cells.
- Exactly one `<h1>` per page: **48/48**.
- Console errors (`console.error` + uncaught `pageerror`): **zero** across all 48.
- `[data-rail-kind="projection"]` subtrees checked for any `text-money`/`border-money`/`bg-money` class on any descendant: **zero violations** across all cells that render a Revenue Rail.
- `Amount`/`<data class="tnum">` rendered on every route that displays money (spot-checked: no money route had zero `<data class="tnum">` elements).

**Member — 7 allowed routes (HOME, NETWORK, MEMBER, LEADERBOARD, PROVENANCE, PROJECTS, PROJECT) + 5 denied routes (OPPORTUNITIES, OPPORTUNITY, ADMIN, FINANCE, SETTLE) × 4 widths = 48 cells:**

- HTTP status: 200 for all 48 (denied routes render `PermissionDenied` in-page, not an HTTP error — matches the tracked contract).
- Same viewport/overflow/h1/console/money checks as founder: **zero failures** across all 48.
- Denied-route bodies spot-checked to contain the real permission-denied copy (`"...permisos de fundador para ver este detalle"`), not a blank or crashed page.

**Combined Mode S total: 96/96 cells passed every assertion.**

### Dynamic 404 matrix

At Mode S founder, `1280`, in-browser and via `curl` (both HTTP client and rendered-page check):

- `/projects/nope` → 404
- `/opportunities/00000000-0000-4000-8000-000000000000` → 404
- `/network/nope` → 404
- `/leaderboard/nope/provenance` → 404

All four returned true HTTP 404, not merely a rendered not-found page with a 200. The Mode-P-authenticated repeat of this check is unavailable for the same reason as Mode D (below).

### Interaction and visual assertions (Mode S founder, 1280 unless noted)

- **767/768 table↔list switch** (`/projects`, `ProjectRecordTable`): at 767 the `<table>` computed `display: none` and the mobile `<ul>` list was visible; at 768 the table was visible and the list computed `display: none`. Matches the `hidden … md:table` / `md:hidden` breakpoint contract exactly.
- **Skip link**: first `Tab` from page load focused the skip link (`<a href="#main-content">`, text "Saltar al contenido"); `Enter` moved focus to `#main-content`, bypassing chrome.
- **Command palette**: `Cmd/Ctrl+K` from the "Buscar" opener button opened `role="dialog"`; 15 subsequent `Tab` presses kept focus inside the dialog (trap confirmed); `Escape` closed the dialog and returned focus to the exact opener (`aria-label="Buscar"` button re-focused).
- **Sidebar compact/hidden persistence**: initial `localStorage['firma23.sidebar-mode']` was `null` (defaults to compact per contract); clicking the TopBar toggle set it to `hidden`; a full page reload preserved `hidden` and the toggle's `aria-label` correctly flipped to "Mostrar menú lateral". (Playwright runs in an isolated, ephemeral Chromium profile — this never touched any real browser's storage.)
- **Reduced motion**: with `prefers-reduced-motion: reduce` emulated at the browser-context level, `window.matchMedia('(prefers-reduced-motion: reduce)').matches` was `true` and a sampled transitioning element's computed `transition-duration` was effectively `0` (`1e-05s`), confirming motion is removed while final state still renders (page did not blank or fail to render).

All of the above were re-run fresh against the exact integrated candidate SHA (`b834030`) in this pass; no lane's prior screenshot or claim was reused as evidence, per the launch contract.

## Unavailable / out of scope

- **Mode D (configured Development founder)**: **UNAVAILABLE**, not substituted. No `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for a canonical Development project exists anywhere in this workspace (`.env.example` ships blank values only) or in the local macOS keychain (checked; not found). Creating or copying such configuration, or authenticating a real founder session, is outside this pass's authorization. Mode S was never substituted for it.
- **Mode-P authenticated-founder recheck of the dynamic-404 matrix**: unavailable for the same reason as Mode D.
- **Adversarial review of the exact candidate SHA** and the **explicit Production/deployment-policy gate**: both are listed in `docs/UI-WORKSPACE-LAUNCH-PLAN.md`'s "Final integration gate" as prerequisites to the final UI PR, but neither was requested of this Integrator pass and neither was performed here. They remain open before `ui/integration` → `main` can be proposed.
- Everything under "Do not" in the operating instructions (push, PR, merge, Preview, Production, Vercel, Supabase, OTP/email, credentials, external resources, package install, remote mutation) was not touched. Playwright/Chromium used an already-downloaded local binary (`/Users/racosta/klokk/node_modules/playwright`, Chromium 1228); nothing was installed for this pass.

## Final state

- `HEAD`: `b8340301af66205bb5bff33e9f35f18bbed77d4f`.
- `git status --porcelain=v1`: empty (clean) at handoff time.
- All servers and browser processes started during this pass were stopped; both `$CONDUCTOR_PORT` uses (Mode P, Mode S) were confirmed free afterward.
- Commits produced, in order: `2bb586c 54d507e 795fd02 09d62ae d12c808 c7f2730 ec76238 f665620 a8ccd42 f8c7e30 832dadd` (six lanes, eleven commits, all preserved individually) followed by `2f128ed` (correction A), `262db24` (correction D), `57c81f3` (correction B), `b834030` (correction C).
- Nothing was pushed; no PR, merge, deploy, or remote mutation occurred.
