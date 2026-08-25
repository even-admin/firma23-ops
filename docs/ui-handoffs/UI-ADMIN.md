# UI-ADMIN handoff

## Provenance

- Branch: `ui-admin-document-command-center`.
- Bootstrap/base SHA: `d0a9583030159da43014249b205547c77f85c638` — verified
  identical to `git rev-parse HEAD` and to
  `git merge-base HEAD origin/ui/integration` before any edit, per the
  dispatch instruction's exact-SHA requirement. `git status --porcelain=v1`
  was empty at that point.
- Implementation SHA (all code, tests, and shared-request changes in this
  handoff): `36a73529d6aa7bde3fbd255690eedc6b8d69654b`.
- This handoff file is committed after that SHA; the final candidate HEAD
  for review is whatever `git rev-parse HEAD` on
  `ui-admin-document-command-center` reports after this file's own commit,
  not the implementation SHA alone — but no code changed between them.
- Worktree was clean (`git status --porcelain=v1` empty) immediately before
  the Mode P build below, and confirmed clean again after every browser QA
  pass (browser QA does not touch the working tree).

## Owned files changed

All within `UI-ADMIN` ownership per `docs/UI-WORKSPACE-LAUNCH-PLAN.md`
("admin page files excluding `intake-actions.ts`"; "`src/components/admin/**`
as presentation only"; "new uniquely named admin tests"; its handoff/request
files):

- `src/app/(network)/admin/finance/[opportunityId]/settle/page.tsx` — added
  the missing `h1` to the member-denied branch only.
- `src/components/admin/ConfirmContractControl.tsx` — added an optional
  `onConfirmed` callback prop, invoked only on a real `'confirmed'` result.
- `src/components/admin/ContractDraftSummary.tsx` — forwards `onConfirmed`;
  replaced the plain source-document text line with `SourceDocumentCard`.
- `src/components/admin/DocumentIntakePanel.tsx` — renders `IntakeStepper`
  and `SourceDocumentCard`; derives step status from real phase/error/
  confirmed state.
- `src/components/admin/IntakeStepper.tsx` (new) — the truthful four-step
  progress indicator.
- `src/components/admin/SourceDocumentCard.tsx` (new) — the selected/
  extracted source-document packet.
- `tests/components/admin-intake-stepper.test.tsx` (new, uniquely named).
- `docs/ui-integration-requests/UI-ADMIN.md` (new, tracked shared request).
- `docs/ui-handoffs/UI-ADMIN.md` (this file).

Not touched: `intake-actions.ts`, `src/types/**`, `src/data/**`,
`src/lib/**`, Auth/Supabase, package manifests/lockfiles, `next.config.ts`,
`src/copy/es-MX.ts`, `FinanceMetricCard`, `RevenueRail`, `Amount`/money,
state/filter/metrics components, any shared test file, or any non-admin
route.

## What changed and why

1. **Truthful `Documento → Extracción → Revisión → Confirmación` stepper**
   (`IntakeStepper.tsx`, wired into `DocumentIntakePanel.tsx`). Status per
   step is a pure function of real state — `Phase`, `ErrorKind`, and a new
   `confirmed` boolean — never a timer or decorative animation:
   - `idle` → step 1 current.
   - a validation error (bad file type/size) → step 1 stays current: no
     real document was ever accepted, so extraction never began.
   - `selected` / `processing` / a server-side extraction error → step 1
     complete, step 2 current.
   - `ready` and not yet confirmed → steps 1–2 complete, step 3 current,
     step 4 upcoming.
   - `ready` and confirmed → steps 1–3 complete, step 4 complete.
   - Verified interactively: after the wired (real, unmocked) confirm
     action resolves `'unavailable'` — the honest outcome in this
     credential-less environment — the stepper stays at step 3, never
     advancing to step 4. See the browser evidence below.
2. **Selected source-document packet** (`SourceDocumentCard.tsx`). Replaces
   the previous bare `"Archivo seleccionado: <name>"` text line with a
   packet-style card, reused in both `DocumentIntakePanel` (pre-extraction:
   filename only, `kindLabel=null`) and `ContractDraftSummary` (post-
   extraction: the real `sourceDocumentKindLabel`/`extractedAt` from the
   view model). Deliberately does not guess a document kind from the
   filename client-side — that classification
   (`guessSourceDocumentKind` in `src/data/repositories/shared/
   intake-labels.ts`) is a frozen `src/data/**` concern already baked into
   the server-returned view model; a component-side guess would be exactly
   the invented-metadata risk the dispatch called out. No fake size,
   author, or status is shown — only the caller-supplied, copy-driven
   labels/state it's given.
3. **`onConfirmed` callback** threaded `ConfirmContractControl` →
   `ContractDraftSummary` → `DocumentIntakePanel`, called only when the
   (real, unmocked in production) confirm action's result is
   `{ kind: 'confirmed' }` — never for `'unavailable'` or `'error'`. This is
   what lets the stepper's step 4 differ honestly from "the founder is
   looking at the confirm button" vs. "confirmation actually happened."
4. **Settle page member-denied `h1` fix** (the accepted lane defect from
   `docs/ui-handoffs/UI-FOUNDATION.md` / `docs/UI-DIRECTION.md`
   "Foundation compatibility" section). The denied branch of
   `admin/finance/[opportunityId]/settle/page.tsx` rendered `PermissionDenied`
   with no heading at all — zero `h1`, not a wrong count. Added a `h1`
   using the existing `copy.settle.title` string, matching the exact
   pattern already used by `/admin` and `/admin/finance`'s own denied
   branches. `PermissionDenied` itself was not touched, per the dispatch
   instruction ("without globally changing PermissionDenied") — every other
   `PermissionDenied` caller (list routes with their own page heading) is
   unaffected.
5. **Existing finance snapshot, manual fallback, matched services/
   milestones/assignments, review issues, and projected-allocation
   preview** were already present and correct in `ContractDraftSummary`/
   `DocumentIntakePanel`/`ManualContractForm` from prior work; verified but
   not restructured.

## Copy/centralization note (tracked shared request)

The four stepper phase labels and the stepper's group `aria-label` are not
yet present anywhere in `copy.admin.intake` in `src/copy/es-MX.ts`, and
that file is an Integrator-owned shared surface `UI-ADMIN` may not edit
(`docs/UI-WORKSPACE-LAUNCH-PLAN.md` ownership matrix). They currently live
as local constants inside `IntakeStepper.tsx` (see the comment there),
functionally complete but not yet centralized. Filed as a non-blocking
request: `docs/ui-integration-requests/UI-ADMIN.md`.

## Commands and outcomes

```
npm run lint       0 problems (eslint . --ignore-pattern ".context/**")
npm run typecheck  0 errors
npm test           308 passed (18 files — 300 pre-existing + 8 new in
                   tests/components/admin-intake-stepper.test.tsx)
npm run build      succeeds — same 13 app routes + /_not-found
```

Full Mode P sequence, candidate SHA `36a73529d6aa7bde3fbd255690eedc6b8d69654b`:

- Preflight: `git status --porcelain=v1` empty; `$CONDUCTOR_PORT` free
  before start (`lsof` empty).
- `rm -rf .next && npm run build` → success, `.next/BUILD_ID` =
  `t9VILZv8pl9WEYn0G6yAY`.
- `npm run start -- --port "$CONDUCTOR_PORT"` → PID 74552, started
  2026-08-25 02:00:45 CST, URL `http://localhost:55180`.
- `GET /dev/states` → `HTTP 404` (mandatory, unauthenticated — passes).
- `GET /favicon.ico` → `HTTP 200`, `content-type: image/x-icon` (passes).
- `GET /admin` (no cookie) → `HTTP 307` to `/login?state=backend-unavailable`
  — the correct M2-Auth behavior for a production build with no Supabase
  configured (`docs/M1-HANDOFF.md`'s successor rule: production missing
  Supabase env vars is "backend-unavailable," never the synthetic viewer).
  This is expected and outside where the settle-page `h1` fix executes;
  that fix's branch is only reached in Mode S/D, verified below.
- Stopped the launched process (`kill 74552`); confirmed the port free
  afterward.

## Mode S (synthetic)

Dev server started with `NEXT_PUBLIC_SUPABASE_URL=` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` explicitly blank in the process
environment; no `.env.local` exists in this workspace, so no real Supabase
config could leak in. Confirmed synthetic mode active (`/admin` rendered
the full founder command center with no login redirect when a founder
cookie was present, and the honest 403 denial when it was not).

**Known viewport limitation, matching the one already recorded in
`docs/ui-handoffs/UI-FOUNDATION.md`:** this session's browser-automation
tool could not be made to report an `innerWidth` other than a fixed
`758×769`, regardless of `resize_window` requests for 375, 767, 768, or
1280 (confirmed via `window.innerWidth`/`outerWidth` after each attempt).
758px is below the 768px `md:` breakpoint, so it does exercise the same
"mobile-recomposed" bucket contracted widths 375 and 767 both fall into
(confirmed: the floating mobile route bar renders, and the desktop sidebar
with the founder/member `ViewerSwitcher` is absent, exactly as the sidebar
contract specifies for `<768px`) — but it is not pixel-exact evidence for
any of 375, 767, 768, or 1280 individually. No 375-specific truncation/
overflow check and no real ≥768 desktop-chrome check were possible in this
session.

A second, unrelated tool limitation: `document.cookie` writes from
`javascript_tool` in this session did not reliably change the viewer role
seen on the next navigation (reads are explicitly blocked by the tool;
writes appeared to silently no-op rather than error). Because of this,
role coverage below is **triangulated across three independent methods**
rather than one continuous interactive session:

1. **Real interactive founder session** (the workspace's pre-existing
   browser cookie, not set by this session): `/admin` rendered the full
   command center — intake stepper at step 1, existing finance snapshot
   (`$56,718.10` cash received, `Cartera` list), zero console errors. The
   full document-first flow was exercised interactively: selecting
   `propuesta-sety.pdf` advanced the stepper to step 2 (`EXTRACCIÓN`) and
   rendered the source-document packet with the file glyph; clicking
   "Procesar documento" advanced to step 3 (`REVISIÓN`), rendered the real
   `ContractDraftSummary` — extracted fields with confidence badges and an
   evidence disclosure, three matched services, seven milestones across
   them, two suggested assignments, the honestly-labeled `PROYECCIÓN`
   allocation rail (never approved/paid styling), and both review issues
   (`FALTA` / `AMBIGUO`) with real detail text; clicking "Confirmar
   contrato existente" produced the honest `unavailable` result
   ("La confirmación requiere un backend de Supabase configurado...") and
   the stepper correctly stayed at step 3 — confirmed by re-reading the DOM
   after the click. `/admin/finance` and the settle page for
   `f0000000-0000-4000-8000-000000000001` (SETY-0142, "Tortillería La
   Ceiba") rendered correctly, one real `h1` each, zero console errors.
   Manual fallback ("Crear manualmente") rendered `ManualContractForm`
   with no document stepper (correct: manual creation skips document/
   extraction entirely) and a disabled confirm button until both fields
   are filled.
2. **Real interactive default (no-cookie) session**, which this app treats
   as member (`getPrototypeViewer()` defaults to `'member'` for any
   missing/unrecognized cookie): `/admin`, `/admin/finance`, and the same
   settle route each rendered `PermissionDenied` with exactly one `h1`
   each — confirmed via `document.querySelectorAll('h1')` in-browser
   (`["Admin"]`, `["Finanzas"]`, `["Aprobación de liquidación"]`
   respectively) and via saved screenshots (see below). This directly
   verifies the settle-page fix in a real browser, not just via HTTP.
3. **`curl` with an explicit `Cookie: f23_prototype_viewer=<role>` header**
   against the same running Mode S server, independent of the browser
   tool's cookie handling — used specifically to cross-check (1) and (2)
   deterministically:

   ```
   GET /admin                                    (no cookie)     -> 1 h1, denied heading class
   GET /admin                    (Cookie: founder)               -> 1 h1, founder heading class
   GET /admin/finance                            (no cookie)     -> 1 h1 (denied)
   GET /admin/finance/f0000000-.../settle         (no cookie)    -> 1 h1: "Aprobación de liquidación"
   GET /admin/finance/f0000000-.../settle (Cookie: founder)      -> 1 h1: "Tortillería La Ceiba"
   ```

   Both settle-page `h1` counts are exactly 1, confirming the fix for both
   roles without relying on the flaky in-browser cookie write.

**Console:** zero errors across the entire interactive session (checked
with `read_console_messages`, `onlyErrors: true`, no pattern restriction
after the first call per tool guidance).

**Money semantics:** the projected-allocation rail inside the ready-state
draft summary is labeled `PROYECCIÓN` and `Aún no es dinero ganado ni por
pagar` ("not yet earned or payable money"); the unit test
`ContractDraftSummary > renders the projected allocation as a projection,
never as approved money` (pre-existing, still passing) asserts zero
`[class*="money"]` elements in that subtree.

## Mode D (configured Development founder)

**UNAVAILABLE**, for the same reason `docs/ui-handoffs/UI-FOUNDATION.md`
recorded: no `.env.local`, no reachable configured Supabase project from
this workspace, and no real invited founder session exists to use.
Honestly recorded as unavailable rather than substituted with Mode S.

## Screenshots (advisory only)

Saved under `.context/qa/UI-ADMIN/36a73529d6aa7bde3fbd255690eedc6b8d69654b/`
(git-ignored, local only), at the one real viewport this session's browser
tool produced (`758×769` — see the limitation noted above, so the width in
each filename is the real one, not a contracted 375/767/768/1280 label):

- `UI-ADMIN-modeS-member-admin-758x769-denied.jpg`
- `UI-ADMIN-modeS-member-finance-758x769-denied.jpg`
- `UI-ADMIN-modeS-member-settle-758x769-denied.jpg`

Founder-role visual states (full command center, intake stepper
progression, draft summary) were verified interactively as described
above but not saved to disk before the cookie-write limitation made the
browser session settle into the member/denied role; they are additionally
confirmed via the `curl` cross-check. `UI-INTEGRATOR` must still freshly
recapture and revalidate the complete matrix on the final integrated SHA;
none of this is final acceptance evidence.

## Shared / cross-ownership requests

- `docs/ui-integration-requests/UI-ADMIN.md` — non-blocking request to
  centralize four stepper labels into `src/copy/es-MX.ts`. See that file
  for the exact requested keys.
- No other shared request. The member-denied opportunity-detail `h1`
  finding from `docs/ui-handoffs/UI-FOUNDATION.md` belongs to
  `UI-OPORTUNIDADES`, not this lane, and was left untouched.

## Confirmation

No unauthorized remote action occurred: no push, no PR, no merge, no
deploy, no Vercel change, no OTP, no Supabase mutation, no dependency
installed. Both servers started during this session (Mode S dev server,
Mode P production server) were stopped and their ports confirmed free.
All work is committed locally only, on `ui-admin-document-command-center`,
not on `main` or `ui/integration`.
