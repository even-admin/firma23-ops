# Invite Center repair — replay-safe idempotency + roster refresh

## Candidate

- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/overnight-ui-ops`
- Branch: `overnight-ui-ops`
- Base (pre-repair): `2799405c1a3ce8fdd9e0eab5ba5d92f0e6cee1a0` (adversarial review brief for `1ce1f42`)
- Repair commit: `71f638cdff5e2b26dc84808f9113a9cf3b08c9b3` — `fix(ops): make invite creation replay-safe`
- Verified before editing: `git merge-base --is-ancestor 1ce1f42... HEAD` passed, and
  `git diff --name-only 1ce1f42...HEAD` showed only
  `docs/ui-handoffs/ADVERSARY-REVIEW-1ce1f42.md` as the sole descendant change.
  Worktree was clean.

## Changed files

- `src/components/admin/InviteMemberForm.tsx`
- `tests/components/admin-invite-member.test.tsx`

## Repairs made

### 1. Durable invite-command idempotency

`InviteMemberForm` previously called `crypto.randomUUID()` on every submit, so a
successful request that lost its response would generate a brand-new key on
retry and defeat the backend replay contract.

The form now derives a canonical request fingerprint the same way
`ManualContractForm` already does for the manual-contract-setup form:

- Canonical identity is `JSON.stringify({ displayName: name.trim(), email:
  email.trim().toLowerCase() })` — JSON, not delimiter concatenation, so values
  like `"a|b"` cannot collide with `["a", "b"]` shapes (mirrors the existing
  `canonicalManualContractSetupRequest` comment/rationale).
- `sha256Hex` (reused from `@/lib/manual-contract-request`, unmodified) hashes
  that canonical string into a fingerprint.
- The idempotency key is looked up first from an in-memory
  `Map<fingerprint, key>` ref, then from `sessionStorage` under
  `firma23.invite-member-attempt:${fingerprint}`, and only generated fresh via
  `crypto.randomUUID()` if neither has it.
- The key is written to both the in-memory map and `sessionStorage` before the
  action call, so a reload mid-flight still finds the same key for the same
  canonical request.
- The stored key (both map entry and `sessionStorage` entry) is deleted only
  when the server authoritatively returns `kind: 'created'`. `error` and
  `unavailable` leave it in place so a retry reuses the same key.
- Changing the trimmed name or the trimmed/lowercased email changes the
  fingerprint, which naturally produces a new key on next submit — no explicit
  invalidation logic needed.

No new dependency, no new shared library file — `sha256Hex` was imported from
the existing `src/lib/manual-contract-request.ts`, which was not modified.

### 2. Refresh the founder roster after success

- Added `useRouter` from `next/navigation`.
- `router.refresh()` is called exactly once, only inside the `kind === 'created'`
  branch, after the stored key is cleared.
- `error` and `unavailable` results do not call `refresh()`.
- The existing `role="status"` / `aria-live="polite"` announcement, the
  `outcomeRef` focus-on-result behavior, and the `aria-busy` pending state on
  the `<section>` are all unchanged.
- Copy is unchanged: `copy.admin.members.deliveryNote` ("Crear una invitación no
  envía un correo automáticamente") still renders unconditionally under the
  form. No code path claims an email was sent.

### 3. Tests

`tests/components/admin-invite-member.test.tsx` now has 9 tests (up from 2),
all passing:

1. Original: creates a pending local invite, no email-sent claim (kept as-is).
2. Original: pending announcement + authoritative error preserved (kept as-is).
3. New: a failed first attempt followed by a retry submits the same
   idempotency key.
4. New: unmounting and remounting the form (simulated reload — `sessionStorage`
   is what survives a real reload, not React state) still reuses the same key
   for the same canonical request.
5. New: changing the canonical name or the canonical email generates a new key
   on the next submit; three progressive submits (base → new email → new name)
   each produce a distinct key from the previous one.
6. New: `router.refresh()` is called exactly once after a `created` result,
   and `router.push` is never called (this form does not navigate).
7. New: `router.refresh()` is not called on an `error` result.
8. New: `router.refresh()` is not called on an `unavailable` result.
9. New: the stored key is only cleared after an authoritative `created` — a
   failed attempt then a successful retry reuse the same key, but a third
   submit after that success (same canonical values) gets a fresh key because
   the store was cleared.

`next/navigation`'s `useRouter` is mocked at module scope, matching the
existing pattern in `tests/components/admin-intake.test.tsx`.

## Command results

Run from `/Users/racosta/conductor/workspaces/firma23-ops/overnight-ui-ops` after
`npm ci` (no `node_modules` existed beforehand; installing it does not modify
`package.json` or `package-lock.json`, both untouched):

- `npm run lint` — **PASS**, zero findings.
- `npm run typecheck` — **FAIL**, pre-existing and out of scope:
  `src/components/visual/mesh-drift-config.ts(19,3): error TS2322: Type
  'string | undefined' is not assignable to type 'string'.` This file was last
  touched by the `1ce1f42` candidate commit itself, is untouched by this
  repair's diff (`git diff --stat` shows only the two files listed above), and
  is explicitly off-limits per the repair scope (`MeshDrift`/global visual
  chrome). Reproduced on the unmodified `2799405` base via `git stash` before
  restoring this repair's changes — confirmed pre-existing, not introduced
  here.
- `npm test` — **1 failed, 415 passed** (416 total, 37 files). The one failure,
  `tests/components/red-operator-identity.test.tsx:119`, is an unrelated
  palette-byte snapshot mismatch in identity-orb visual code (also off-limits:
  `IdentityOrb`). Confirmed pre-existing the same way (`git stash` + rerun
  against `2799405`, same failure, same file, before restoring this repair).
  The invite-member test file itself: **9/9 passed**.
- `rm -rf .next && npm run build` — **FAIL**, blocked by the same pre-existing
  `mesh-drift-config.ts` typecheck error during `next build`'s TypeScript pass
  (compile step itself succeeded: "Compiled successfully in 2.1s").
- `bash scripts/db-verify.sh` — **PASS**, 179 passed, 0 failed (unchanged from
  the adversary review's own evidence; this repair touches no migration or
  RPC).

## Browser QA

Dev server started fresh from this repaired worktree with
`NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` blank
(synthetic/prototype mode, confirmed via `isSupabaseConfigured()` routing to
`syntheticInviteRepository`). No account, migration, or remote service was
touched.

Verified at `/admin/members` in founder prototype mode (via the existing
`ViewerSwitcher` "Fundador"/"Operador" toggle — no injected test route needed,
none exists for this form):

- **Founder access**: form renders normally.
- **Non-founder denial**: switching the prototype viewer to "Operador" and
  reloading `/admin/members` renders `403 / privado — Necesitas permisos de
  fundador para ver este detalle`. Confirms UI-level founder gating still
  holds (RLS remains the real authority per the app's own disclaimer text on
  screen).
- **Form validation**: "Crear invitación" starts disabled; becomes enabled
  only once both a name and an RFC-shaped email are entered.
- **Honest unavailable state**: submitting with Supabase unconfigured returns
  `syntheticInviteRepository.create`'s honest `unavailable` result —
  "Crear integrantes requiere un backend de Supabase configurado" — not a
  fabricated success. Focus moved to the `role="status"` element (visible
  focus outline confirmed).
- **Delivery note always visible**: "Crear una invitación no envía un correo
  automáticamente." renders under the form regardless of result state.
- **44px controls**: measured via `getBoundingClientRect()` — name input,
  email input, and submit button are all exactly 44px tall.
- **One `<h1>`**: confirmed (`document.querySelectorAll('h1').length === 1`).
- **No horizontal overflow**: `scrollWidth === clientWidth` at the available
  viewport.
- **Zero console errors**: `read_console_messages` after a fresh page load and
  through the interaction sequence showed only React DevTools/HMR info logs.

### UNAVAILABLE

- **Exact 375 / 768 / 1280 px viewport screenshots.** The `resize_window`
  browser tool reported success and did change `window.outerWidth`, but the
  page's actual rendered viewport (`document.documentElement.clientWidth`,
  screenshot dimensions) stayed fixed at the browser's real display size
  (~1910×990) throughout — this looks like a fixed virtual-display constraint
  of the local Chrome automation tooling in this environment, not a defect in
  the app. All functional/accessibility/overflow checks above were run at the
  viewport that was actually available; the responsive Tailwind classes
  (`sm:grid-cols-2`, `sm:p-6`, single-column stacking below `sm:`) are
  unchanged from the reviewed `1ce1f42` candidate and were not touched by this
  repair.
- **Success + `router.refresh()` behavior in the live browser.** With Supabase
  intentionally left unconfigured (per task constraints — no real invite, no
  Auth user, no remote credentials), the synthetic repository always returns
  `kind: 'unavailable'`, so a `created` outcome cannot occur in this browser
  session. This exact behavior (refresh called once on `created`, never on
  `error`/`unavailable`) is proven instead by the unit tests in
  `tests/components/admin-invite-member.test.tsx` with an injected mock
  `createAction`, which is the intended seam for testing this path per the
  component's existing `createAction` prop design.

## Explicit statement

**Creating an invitation does not send an email.** No email was sent, no Auth
user was created, no Supabase project was touched, and no migration was
applied at any point during this repair.

## Not done / out of scope

- No push, no PR, no deploy, no migration apply, no remote service access.
- No fix attempted for the pre-existing `mesh-drift-config.ts` typecheck error
  or the pre-existing `red-operator-identity.test.tsx` snapshot failure — both
  are outside this repair's scope (visual/global chrome, explicitly
  off-limits) and were confirmed pre-existing on the unmodified base.
- `package.json` / `package-lock.json` untouched; `node_modules` was installed
  locally via `npm ci` only to run the required QA commands.
