# Founder crew management — build handoff

## Candidate

- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/overnight-ui-ops`
- Branch: `overnight-ui-ops`
- Required starting SHA (verified exact before editing): `d005714d48b631b188209837575e1851686d514a`
- Commit produced by this build: pending — see "Commit" below (created immediately after this document, as one logical checkpoint `feat(ops): add audited founder crew management`).
- Verified before editing: `git rev-parse HEAD` matched the required SHA exactly, branch was `overnight-ui-ops`, `git status --short` was empty, and no `.git/index.lock` or running `next dev`/`vitest`/`npm run` process was found.

## Changed files

- `supabase/migrations/20260827090000_opportunity_crew_management.sql` (new, additive)
- `scripts/db-verify.sh` (scenario 24 appended)
- `src/types/views.ts` (added `ReplaceOpportunityCrewAssignmentInput`, `ReplaceOpportunityCrewInput`, `ReplaceOpportunityCrewResult`)
- `src/data/repositories/crew.ts` (new — `CrewRepository` interface)
- `src/data/repositories/supabase/crew.ts` (new)
- `src/data/repositories/synthetic/crew.ts` (new)
- `src/data/repositories/active/crew.ts` (new)
- `src/app/(network)/opportunities/[opportunityId]/crew-actions.ts` (new Server Action)
- `src/app/(network)/opportunities/[opportunityId]/page.tsx` (wires `CrewManager` into the existing founder-only detail route, fetches `assignmentMembers` the same way `admin/page.tsx` already does)
- `src/components/opportunity/CrewManager.tsx` (new)
- `src/copy/es-MX.ts` (added `detail.crew.*`)
- `tests/components/opportunity-crew-manager.test.tsx` (new, 10 tests)

No migration, finance write RPC, Auth/redeem-invite logic, project setup RPC, global CSS/tokens/chrome/Mesh/IdentityOrb, document intake/AI/XP/image/connector code, package file, or Vercel/Supabase configuration was touched.

## Database contract: `replace_opportunity_crew`

SECURITY DEFINER RPC, additive migration only. Mirrors the existing finance-write-RPC conventions (`record_cash_event`, `approve_settlement`, `reverse_settlement`, `record_payout`) and `create_manual_contract_setup`'s assignment-validation shape exactly:

- Actor resolved exclusively via `current_member_id()`/`auth.uid()`; requires active founder membership in the claimed org.
- Locks the target opportunity (`for update`) before any replay/read/write decision.
- Validates a full-replacement payload (`memberId`, `roleLabel`, `weightBp`): non-empty array, exact object shape, valid UUID, non-empty role label ≤200 chars, integer weight 1–10000bp, unique members, total exactly 10,000bp, and every member an **active** same-org membership (invited, revoked, absent, and cross-org members are all rejected with the same message family `create_manual_contract_setup` already uses).
- Refuses the command outright if the opportunity has **any** row in `settlements` (any status) — `settlement_lines` and `settlement_line_payouts` cannot exist without a parent `settlements` row, so this one check also covers reversals and payouts, exactly as required.
- **Scope limitation, explicit and tested**: operates only on an opportunity whose allocation rule has exactly one `member_pool` share (the shape every `create_manual_contract_setup` opportunity has). An opportunity with more than one pool (e.g. a closer/delivery split) is refused with a named error rather than guessed at — "do not invent financial rules."
- Idempotency: one `opportunity_crew_receipts` row per call, scoped `(org_id, opportunity_id, idempotency_key)`, matching the single opportunity locked per call. A canonical-JSON fingerprint (`replace_opportunity_crew_request_fingerprint`, non-callable directly by PUBLIC/anon/authenticated) makes a same-key-same-request replay return the original outcome, and a same-key-different-request reuse fail deterministically.
- Writes exactly one `audit_events` row on a genuine change, never on a replay. Writes no `cash_events`, `settlements`, `payouts`, `stat_events`, or XP row.
- Full replacement is implemented as `delete` + re-`insert` on `public.assignments` scoped to the resolved single `role_key` — safe only because the settlement-block check above guarantees no `settlement_lines` can reference the deleted rows' data at that point.
- `assignments_founder_write` (the prior "founder can insert/update/delete" RLS policy) is dropped. `assignments_select_founder` and `assignments_select_self` are untouched, so read access is preserved. Both `create_manual_contract_setup` and `replace_opportunity_crew` are SECURITY DEFINER and bypass RLS on the tables they write internally (same rationale as `create_manual_contract_setup`'s own file header), so dropping this policy closes the only remaining direct-write door without touching either RPC.

**Money honesty, by construction, not by added logic**: this RPC never touches `opportunity_projection_versions`. `member_opportunity_financials()` (existing) already derives each member's projected share live from the *current* assignment weights, and `approve_settlement` (existing) always reads assignments at approval time — so a crew replacement immediately and correctly changes what an affected member sees as their projected share, without ever rewriting or fabricating an immutable projection row. This is documented in the migration's own header comment.

Two bugs were caught and fixed by the DB harness before it passed:
1. **Ambiguous column reference** (`opportunity_id`) between the function's own `returns table (opportunity_id ...)` OUT parameter and the `opportunity_crew_receipts`/`settlements`/`assignments` tables' own `opportunity_id` column — the exact pitfall `reverse_settlement`'s own code comment already documents for `settlement_id`. Fixed by table-aliasing every such reference.
2. The receipt insert's `on conflict (org_id, opportunity_id, idempotency_key)` column list was *also* rejected as ambiguous by Postgres for the same reason. Fixed by dropping the `ON CONFLICT` clause entirely — matching `create_manual_contract_setup`'s own final (hardened) form, which relies purely on the opportunity lock for serialization, not a fallback upsert.

## UI

- `CrewManager` renders a "Gestionar equipo" toggle button (44px) on the existing founder-only opportunity detail route. Opening it reveals an inline editor (not a modal — explicitly allowed by the packet) pre-filled from the opportunity's current assignments.
- **Multi-pool honesty fix found during manual browser QA**: every synthetic/seed fixture opportunity has two pools (closer + delivery). A first pass merged all current assignments into one flat row list, showing a nonsensical "200%" total that could never be submitted (the RPC would refuse it anyway). Fixed by detecting `>1` distinct `roleKey` among current assignments and rendering an honest `detail.crew.multiplePools` message instead of a broken editor — covered by a new unit test and confirmed live in the browser.
- Idempotency key: canonical JSON fingerprint of `{opportunityId, assignments}` (sorted, mirroring `ManualContractForm`'s existing `canonicalManualContractSetupRequest` pattern), SHA-256'd via the existing `sha256Hex` helper, held in an in-memory `Map` plus `sessionStorage` under `firma23.crew-replace-attempt:<fingerprint>`. Cleared only on an authoritative `kind: 'replaced'`. A retry after failure reuses the key; changing the crew composition (member, role, or weight) produces a new key.
- `router.refresh()` is called exactly once, only on `kind: 'replaced'`, immediately closing the editor. `error`/`unavailable` leave the editor open with the message focused (`role="status"`, `aria-live="polite"`, matching `InviteMemberForm`'s existing accessibility pattern).
- Submit is disabled until every row has a member, a non-empty role label, and weights total exactly 10,000bp (100%); a duplicate member also disables submit.
- An opportunity with zero available active members renders an honest `detail.crew.noMembers` message instead of an empty, unusable editor.
- Member denial: the entire opportunity detail route already returns `PermissionDenied` (`403 / privado`) for non-founders before this section is reached — confirmed live in the browser (see below) — so `CrewManager` never renders any control or payload detail to a member.
- Synthetic mode: `syntheticCrewRepository.replaceOpportunityCrew` always returns `kind: 'unavailable'` with the same honest `copy.detail.crew.unavailable` message the rest of the app uses for "requires a configured Supabase backend," never a fabricated success.

## Command results

Run from a fresh `npm ci` install (no prior `node_modules`; installing does not modify `package.json`/`package-lock.json`, both untouched):

- `npm run lint` — **PASS**, zero findings.
- `npm run typecheck` — **1 pre-existing, out-of-scope failure**: `src/components/visual/mesh-drift-config.ts(19,3)`, unchanged by this diff (confirmed via `git stash` against the base SHA in the immediately preceding Invite Center session of this same workspace) and explicitly off-limits (`MeshDrift`/global visual chrome). No new typecheck error from this change.
- `npm test` — **425/426 passed**. The one failure, `tests/components/red-operator-identity.test.tsx:119` (an identity-orb palette-byte snapshot), is the same pre-existing, out-of-scope failure confirmed earlier this session and unrelated to crew management (`IdentityOrb` is explicitly off-limits). The two new test files — `tests/components/opportunity-crew-manager.test.tsx` (10 tests) — all pass.
- `rm -rf .next && npm run build` — Next.js compilation itself succeeds ("Compiled successfully"); the build's own TypeScript pass fails on the same pre-existing `mesh-drift-config.ts` error above, unrelated to this change.
- `bash scripts/db-verify.sh` — **PASS, 200 passed, 0 failed** (up from 179 before this change — scenario 24 adds 21 new checks). Disposable PostgreSQL applied every migration and the seed from zero, including the new migration.

## Required evidence — DB harness scenario 24

All 11 items from the packet are covered:

1. Founder replaces crew atomically, exactly one audit record, zero cash/settlement/stat rows — PASS.
2. Same command replay returns the original result, no duplicate assignment/audit rows — PASS.
3. Mismatched idempotency key reuse fails deterministically — PASS.
4. Member, anon, revoked founder, and cross-org founder are all denied — 4 separate PASS scenarios.
5. Invited, revoked, and cross-org members cannot be assigned — 3 separate PASS scenarios.
6. Duplicate members, empty role label, zero weight, and non-10,000bp total all rejected — 4 separate PASS scenarios.
7. Any settlement authority blocks the command and leaves the crew unchanged — verified against the seeded multi-settlement opportunity `f0000000-…-003`, plus a follow-up assertion that its assignment count was untouched after the blocked attempt.
8. Direct authenticated `assignments` INSERT is denied (raises "row-level security policy"); UPDATE and DELETE are proven to silently affect **zero rows** (RLS with no applicable policy filters the row set rather than erroring on UPDATE/DELETE, so these are asserted via `GET DIAGNOSTICS ... row_count` inside a `DO` block, not `expect_failure`).
9. Folded into item 1's assertion (`cash_events`, `settlements`, `stat_events` counts all zero after the write).
10. UI retry/refresh behavior — proven by the unit tests (see below), not the DB harness.
11. Member UI denial and synthetic unavailable state — proven by unit tests and live browser QA (see below).

## Browser QA

Dev server started fresh from this worktree with `NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` blank (synthetic mode). No account, migration, or remote service was touched.

- **Founder access, editor pre-fill**: navigated to `/opportunities/f0000000-0000-4000-8000-000000000001` as founder (via the existing `ViewerSwitcher`), clicked "Gestionar equipo" — editor opened pre-filled with the opportunity's real current rows (member, role, weight%).
- **Multi-pool honesty**: this exact opportunity has two pools (closer 100% + delivery 100%, merged naively would show "200%"). Confirmed the fix renders the honest `multiplePools` message instead, both via the new unit test and live in the browser after the fix (`document.body.innerText.includes('más de un grupo')` → `true`).
- **44px controls**: measured "Gestionar equipo" via `getBoundingClientRect()` — exactly 44px tall.
- **Member denial**: switched the prototype viewer to "Operador" and reloaded the same URL — the entire route renders `403 / privado — Necesitas permisos de fundador para ver este detalle`; `CrewManager` is never reached, confirming no control or payload detail leaks to a member view.
- **Zero console errors**: `read_console_messages` across the whole sequence showed only React DevTools/HMR info logs.
- Switched the viewer back to "Fundador" before ending the session (state left as found).

### UNAVAILABLE

- **Live-browser submit flow (pending → replaced/error/unavailable → refresh) against a real single-pool opportunity.** Every opportunity in the synthetic/seed fixture data (`sety-2026`, `ai-ops-retainer`) has two or more `member_pool` shares (closer + delivery); no single-pool fixture opportunity exists to exercise the actual editor's submit path live (a `create_manual_contract_setup` call would create one, but that mutates the shared dev dataset, which the task's "do not create a real invite" spirit and the fixture-data-is-shared-across-sessions concern both argue against doing casually in a manual QA pass). This exact behavior — pending announcement, honest `unavailable` reason, error message focus, `router.refresh()` called exactly once only on success, never on error/unavailable — is proven instead by `tests/components/opportunity-crew-manager.test.tsx` with an injected mock `replaceAction`, the same seam `InviteMemberForm`/`ManualContractForm` already use for this exact class of test.
- **Exact 375/768/1280px viewport screenshots.** This browser session's actual rendered viewport was fixed at 530×810 regardless of navigation; `resize_window`/`window.resizeTo` changed `outerWidth` but not the page's own `clientWidth` — the same fixed-virtual-display constraint already noted as UNAVAILABLE in `docs/ui-handoffs/INVITE-CENTER-REPAIR.md` for this Chrome automation tooling. All functional/accessibility/overflow checks above were run at whatever viewport was actually available. The Tailwind classes used (`sm:grid-cols-[2fr_2fr_1fr_auto]`, `min-h-11` throughout) follow the same responsive/44px conventions as the rest of the codebase but were not independently screenshotted at each named breakpoint.

## Known pre-existing global failures (unrelated to this change)

- `src/components/visual/mesh-drift-config.ts(19,3)`: TS2322, blocks `npm run typecheck` and `npm run build`'s type-check pass. Confirmed present on the unmodified base and out of scope (`MeshDrift` is explicitly off-limits).
- `tests/components/red-operator-identity.test.tsx:119`: a palette-byte snapshot mismatch in identity-orb visual code. Confirmed present on the unmodified base and out of scope (`IdentityOrb` is explicitly off-limits).

Both were independently re-confirmed pre-existing in the immediately preceding Invite Center repair session on this same workspace/branch (see `docs/ui-handoffs/INVITE-CENTER-REPAIR.md`), and again here — this candidate's diff does not touch either file.

## Exact Fable review questions

1. Does dropping `assignments_founder_write` leave any other legitimate authenticated write path onto `public.assignments` besides `create_manual_contract_setup` and `replace_opportunity_crew`, both SECURITY DEFINER? (Reviewer should attempt a direct authenticated INSERT/UPDATE/DELETE independently, not just trust the DB harness's own three assertions.)
2. Is "any row in `settlements` regardless of status" the correct and complete block condition, or does a `pending` (not yet `approved`) settlement deserve different handling — e.g. should a founder be allowed to replace crew while a settlement is merely `pending`, since no money has been approved yet?
3. Is the single-member-pool scope limitation (refusing any opportunity with more than one `member_pool` share) an acceptable V1 boundary, or does it under-serve the SETY-style closer/delivery opportunities that make up most of the current seed data? If broader support is wanted, what should the payload shape be — a `roleKey` field per assignment, or one `replace_opportunity_crew` call per pool?
4. Does the full delete-then-reinsert of `public.assignments` rows (new UUIDs each time) break any other code path that references an `assignments.id` by value across a crew replacement (e.g. cached client state, an evidence link, a milestone assignment) — this migration did not audit every FK/soft-reference to `assignments.id` beyond `settlement_lines` (which is provably absent given the settlement-block guard)?
5. Is the request-fingerprint's exclusion of `roleKey` from the crew payload (it's derived server-side, not client-supplied) a safe simplification, or should the fingerprint also pin the resolved `role_key` so a rule-version change between a request and its replay can't silently change which pool the replay targets?

## Not done / out of scope

No push, PR, deploy, migration apply, or remote service access occurred. **Creating a crew replacement writes no cash event, settlement, payout, stat event, or XP row, and sends no email.**
