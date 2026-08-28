# Crew management repair — multi-pool support + audited before/after history

## Candidate

- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/overnight-ui-ops`
- Branch: `overnight-ui-ops`
- Required starting SHA (verified exact before editing): `a3bb5307caccce4675b499190da840dde9e00716`
- Verified before editing: `git rev-parse HEAD` matched exactly, branch was `overnight-ui-ops`, `git status --short` was empty, no `.git/index.lock`, and no `next dev`/`vitest`/`npm run` process running in this workspace.
- Commit produced by this repair: pending, created immediately after this document as `fix(ops): support audited multi-pool crew management`.

## Scope

Repaired exactly the two accepted findings from `docs/ui-handoffs/CREW-MANAGEMENT.md`'s Fable review questions #3 and #4-adjacent gap. No other file outside the allowed ownership list was touched. The unapplied migration `20260827090000_opportunity_crew_management.sql` was edited **in place** (per instructions), not superseded by a new migration — it has never been applied to any real Supabase project.

## Finding 1: multi-pool support

### Database

`replace_opportunity_crew` gained a required `p_role_key text` parameter, inserted between `p_opportunity_id` and `p_assignments`:

```
replace_opportunity_crew(p_org_id, p_opportunity_id, p_role_key, p_assignments, p_idempotency_key)
```

- `p_role_key` is validated server-side against the opportunity's **current** allocation rule version: it must name a real `member_pool` share. An `org_recipient` share (e.g. `firma23`/house) or a nonexistent key is refused with `replace_opportunity_crew: % is not a member_pool key on opportunity %'s allocation rule` — never inferred, never guessed.
- The prior "exactly one pool or refuse" check is gone entirely. An opportunity with any number of pools works — each call touches exactly one.
- The `delete ... where role_key = p_role_key` / re-insert is scoped to that one pool. Every other pool's assignment rows are never selected, deleted, or touched by the call — proven by the DB harness (item 2 below).
- `p_role_key` is included in the canonical request fingerprint (`replace_opportunity_crew_request_fingerprint` gained the same parameter, in the same position). This means: the same idempotency key reused against a *different* pool produces a *different* fingerprint, so the replay-vs-mismatch check that already existed catches it automatically — no separate "does the stored role_key match" comparison was needed.
- Settlement-authority blocking, active-membership validation, weight/shape validation, founder-only authority, and the direct-write RLS hardening (`assignments_founder_write` dropped) are all unchanged and re-verified.

### UI

`CrewManager` is now two components:
- `CrewManager` (exported, unchanged name so `page.tsx`'s import didn't need touching beyond its props): takes `pools: readonly PoolWeightView[]` and `assignments: readonly AssignmentView[]`, and renders one `PoolCrewManager` per pool, filtering `assignments` to that pool's `roleKey`. Returns `null` if the opportunity has zero pools.
- `PoolCrewManager` (internal, not exported): the actual editor — identical shape to the prior single-pool component, but scoped to one `poolKey`/`poolLabel` at a time, with its own independent `useState`/`useRef` instances. Because React gives each `<PoolCrewManager key={pool.key} .../>` its own component instance, editing one pool's rows, pending state, focus, or idempotency key **cannot** reach another pool's instance — this is a structural guarantee from React's reconciliation model, not a manually-maintained invariant.
- Pool label/key come from `PoolWeightView` (`detail.pools`), the same existing view-model data `AssignmentList` already renders from — never inferred from which pools happen to have assignments today. An unstaffed pool (zero current assignments) still gets its own manager, defaulting to one empty row.
- The generic "this opportunity has more than one pool, unsupported" message and its `copy.detail.crew.multiplePools` string are removed entirely — replaced by the working per-pool editors.
- 44px controls, keyboard access, focus-on-result, `router.refresh()` called exactly once and only on `kind: 'replaced'`, and the honest synthetic `unavailable` state are all unchanged and re-verified per pool.
- Member denial is unchanged: the entire opportunity detail route still returns `PermissionDenied` (`403 / privado`) for non-founders before `CrewManager` is ever reached — confirmed live in the browser (see below).

## Finding 2: meaningful crew-change history

### Database

`opportunity_crew_receipts` gained three columns:

- `role_key text not null` — which pool this receipt is for.
- `before_assignments jsonb not null` — the pool's assignment rows *before* this call, in the canonical `{memberId, roleLabel, weightBp}` shape (same shape the fingerprint hashes), sorted deterministically by `(memberId, roleLabel, weightBp)`. `'[]'::jsonb` (never `null`) if the pool was unstaffed.
- `after_assignments jsonb not null` — the same shape, from the validated request payload.

Both snapshots are taken *before* the `delete`/`insert` on `public.assignments`, inside the same transaction, so they are exact.

The table gained a `before update or delete` trigger calling the existing `public.forbid_mutation()` (the same function `opportunity_projection_versions` and `evidence_links` already use), making the receipt genuinely immutable at the database level — not just "nothing currently writes to it."

The audit event's `target_table`/`target_id` now point at the receipt (`'opportunity_crew_receipts'`, the new receipt's `id`) instead of the opportunity — so a founder tracing an audit event lands directly on the exact before/after evidence, not just a bare opportunity reference. The summary text names the pool (`role_key`) and member count only; it carries no email, cash figure, settlement, or payout value, matching the existing `record_cash_event`/`record_payout` summary convention.

A genuine command still writes exactly one receipt and exactly one audit event; a replay writes neither (verified).

### RLS

Unchanged: `opportunity_crew_receipts_select_founder` (founder-only select) is the only read policy, and there is still no insert/update/delete policy for `authenticated` at all — only the SECURITY DEFINER RPC writes, and the new `forbid_mutation` trigger blocks any further mutation even for a caller who could otherwise reach the row (e.g. the table owner).

## Command results

Run from this worktree (dependencies already installed from the prior session; `npm ci` re-run to confirm a clean install):

- `npm run lint` — **PASS**, zero findings.
- `npm run typecheck` — **1 pre-existing, out-of-scope failure**: `src/components/visual/mesh-drift-config.ts(19,3)`, unchanged by this diff and explicitly off-limits (`MeshDrift`/global UI). No new typecheck error from this repair. (One real typecheck bug this repair itself introduced and fixed during development: `CrewManager`'s `replaceAction` prop threading violated `exactOptionalPropertyTypes` when an explicit `undefined` was passed down to `PoolCrewManager` — fixed by defaulting `replaceAction` once, in `CrewManager` itself, so the value passed down is always a defined function.)
- `npm test` — **429/430 passed**. The one failure, `tests/components/red-operator-identity.test.tsx:119`, is the same pre-existing, out-of-scope identity-orb palette-byte snapshot confirmed in both prior sessions on this workspace, unrelated to crew management. `tests/components/opportunity-crew-manager.test.tsx` — rewritten for the pool-scoped API — **14/14 passed**, up from 10 (new coverage: one-manager-per-pool, per-pool pre-fill, cross-pool non-mutation, correct `roleKey` per submit, zero-pools renders nothing).
- `rm -rf .next && npm run build` — Next.js compilation itself succeeds ("Compiled successfully"); the build's own TypeScript pass fails on the same pre-existing `mesh-drift-config.ts` error, unrelated to this change.
- `bash scripts/db-verify.sh` — **PASS, 212 passed, 0 failed** (up from 200 before this repair — scenario 24 gained 12 new checks net for multi-pool + history evidence, replacing/extending the old single-pool-only assertions).

## Required DB-harness evidence (all 10 items)

1. **Safe multi-pool replace** — a fresh multi-pool (closer + delivery) opportunity was direct-inserted as a fixture (no settlement), then `replace_opportunity_crew(..., 'delivery', ...)` replaced only the delivery pool. PASS.
2. **Untouched pool unchanged** — asserted the closer pool's single row (member, role label, weight, status) is byte-for-byte identical after the delivery-pool call. PASS. A second independent-edit test also replaced the closer pool afterward and asserted delivery was still intact. PASS.
3. **Invalid/non-member-pool roleKey rejected** — tested both a nonexistent key (`ghost-pool`) and a real but `org_recipient` key (`firma23`, the house share) — both rejected with the same "is not a member_pool key" message. PASS × 2.
4. **Replay returns original outcome, no extra receipt/audit** — same idempotency key + same pool + same payload replayed; asserted `replayed = true` and receipt/audit counts unchanged. PASS.
5. **Same key, changed pool or payload, fails** — tested both: same key targeting a different pool, and same key/pool with a different member — both fail with "already used for a different crew replacement request". PASS × 2.
6. **Receipt contains exact canonical before/after** — asserted `before_assignments`/`after_assignments` equal the exact expected canonical jsonb arrays. PASS (folded into item 1's assertion block).
7. **Audit event points to the receipt** — asserted `audit_events.target_table = 'opportunity_crew_receipts'` and `target_id` equals the receipt's own `id`. PASS (folded into item 1's assertion block, and re-asserted for the single-pool regression test).
8. **Existing settlement authority still blocks all pool changes** — re-tested against the seeded multi-settlement opportunity, once for its existing pool and once for an *unrelated* pool name on that same opportunity, both blocked; a follow-up assertion confirms its assignment count is unchanged. PASS × 3.
9. **Direct assignment INSERT/UPDATE/DELETE remain denied** — unchanged from the prior session's evidence, re-verified: INSERT raises "row-level security policy"; UPDATE/DELETE silently affect zero rows (asserted via `GET DIAGNOSTICS`). PASS × 3.
10. **No money/settlement/payout/stat/XP/projection-version write** — asserted zero rows in `cash_events`, `settlements`, `stat_events`, and (newly added to this assertion) `opportunity_projection_versions`, for both the multi-pool and the single-pool regression scenarios. PASS × 2.

Two additional receipt-immutability checks were added beyond the required list: a direct authenticated `UPDATE` on `opportunity_crew_receipts` affects zero rows (no update policy), and a same-owner `UPDATE` (bypassing RLS, to isolate the trigger itself) is rejected by `forbid_mutation` with "append-only" — proving the immutability is enforced by the trigger, not merely by the absence of a policy.

## Required UI evidence

- **One manager per pool** — `tests/components/opportunity-crew-manager.test.tsx`: "renders one independent manage button per real pool from the view model". PASS.
- **Editor submits the correct `roleKey`** — "submits the correct roleKey for each pool" asserts `replaceAction.mock.calls[0][0].roleKey === 'delivery'` when only the delivery editor is submitted. PASS.
- **Pool A edit does not mutate pool B** — two tests: one purely at the DOM/state level ("editing pool A does not mutate pool B... leaves the open Entrega editor untouched"), one at the submitted-payload level ("pool A edit does not mutate pool B's submitted payload" — edits Cierre, submits Entrega, asserts the submitted `assignments` array is still exactly Entrega's original row). PASS × 2.
- **Retry/refresh behavior remains correct** — idempotency-key reuse on retry, new key on composition change, `router.refresh()` called exactly once only on `replaced`, never on `error`/`unavailable`. PASS × 4 (carried over from the prior session, re-verified against the new pool-scoped API).
- **No member controls, honest synthetic unavailable state** — member denial is unchanged at the page level (verified live in the browser, see below, not a unit test — `CrewManager` is simply never rendered for a non-founder viewer); the synthetic `unavailable` result and its focused message are unit-tested. PASS.

## Browser QA

Dev server started fresh from this worktree with `NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` blank (synthetic mode). No account, migration, or remote service was touched.

- Navigated to `/opportunities/f0000000-0000-4000-8000-000000000001` (the same real multi-pool fixture opportunity that exposed the original bug) as founder. Confirmed via `document.querySelectorAll('button')` two independent manage buttons: **"Gestionar equipo · Cierre"** and **"Gestionar equipo · Producción"** — the exact pool labels from `detail.pools`, not a generic name.
- Opened both editors simultaneously. Screenshot confirms "Gestión de equipo · Cierre" pre-filled with its one real row (Sebastián Benítez, Cierre, 100%) and "Gestión de equipo · Producción" pre-filled with its three real rows (Emiliano Pasos 40%, Pablo Heisenberg 35%, Diego Martínez Hernández 25%), each with its own independent "Guardar equipo"/"Cancelar".
- Edited the Cierre pool's role label live; confirmed via screenshot that Producción's three rows were completely unaffected — live confirmation of the unit-tested non-mutation guarantee.
- Submitted the Cierre editor: got the honest `unavailable` message ("Gestionar el equipo requiere un backend de Supabase configurado") with visible focus, matching the synthetic repository's honest response — never a fabricated success. Producción's rows remained untouched throughout.
- Switched the prototype viewer to "Operador" (member) and reloaded — the entire route still renders `403 / privado`; `CrewManager` is never reached, so no crew control or payload detail leaked to a member view.
- Zero console errors across the whole sequence (`read_console_messages` showed only React DevTools/HMR info logs).
- Switched the viewer back to "Fundador" before ending the session (state left as found).

### Note on one verification limitation encountered during this pass

An attempt to verify cross-pool independence via raw `element.value = ...` + a dispatched `input` event (rather than a real keystroke) did not reliably update React's controlled-input state — a known quirk of bypassing React's native-setter override when scripting a controlled input directly, not a defect in the component. The screenshot-based verification above (editing via the DOM, screenshotting, confirming the other pool's rows are pixel-identical) is what actually demonstrates the behavior live; the authoritative, mechanically-reliable proof of cross-pool independence is the two unit tests, which use Testing Library's `fireEvent.change` (the correct way to script a controlled input) and assert on the exact submitted payload rather than a screenshot.

### UNAVAILABLE

- **Exact 375/768/1280px viewport screenshots** — same fixed-virtual-display constraint of this Chrome automation tooling already documented as UNAVAILABLE in the two prior handoffs on this workspace (`INVITE-CENTER-REPAIR.md`, `CREW-MANAGEMENT.md`). All functional/accessibility checks above were run at whatever viewport was actually available.
- **Live-browser success + `router.refresh()` proof** — same reason as the prior session: synthetic mode always returns `unavailable`, so a `replaced` outcome cannot occur live without a real Supabase project. Proven instead by the unit tests with an injected mock `replaceAction`.

## Known pre-existing global failures (unrelated to this repair)

- `src/components/visual/mesh-drift-config.ts(19,3)`: TS2322, blocks `npm run typecheck` and `npm run build`'s type-check pass. Confirmed present before this repair and out of scope (`MeshDrift` explicitly off-limits).
- `tests/components/red-operator-identity.test.tsx:119`: a palette-byte snapshot mismatch in identity-orb visual code. Confirmed present before this repair and out of scope (`IdentityOrb` explicitly off-limits).

Both were independently re-confirmed pre-existing in the two immediately preceding sessions on this same workspace/branch; this repair's diff does not touch either file.

## Not done / out of scope

No push, PR, deploy, migration apply, or remote service access occurred. **Creating a crew replacement writes no cash event, settlement, payout, stat event, XP row, or projection-version row, and sends no email.**
