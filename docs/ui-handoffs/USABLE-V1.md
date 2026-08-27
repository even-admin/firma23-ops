# FIRMA23 Usable V1 Handoff

## Scope

- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/abuja`
- Branch: `ui-integrator-merge-six-lanes`
- Required starting HEAD: `1bcb8606fa27102a521600899cc8d5f3614c8e33`
- Base branch: `origin/ui/integration`
- Initial worktree note: one prior in-progress untracked migration was present at `supabase/migrations/20260826120000_manual_contract_setup.sql`; it was reviewed and completed as part of this checkpoint.

This checkpoint implements the Usable V1 slice from `docs/USABLE-V1-MASTER-PLAN.md`: founder-only manual contract setup, assignment capture, projected distributable amount as non-ledger projection data, and configured-mode canonical Supabase reads for the listed operating routes.

## Implemented

- Added additive migration `20260826120000_manual_contract_setup.sql`.
- Added `opportunity_projection_versions` for append-only non-ledger projected bases.
- Added `manual_contract_setup_receipts` for idempotent founder setup receipts.
- Added founder-only RPC `create_manual_contract_setup(...)` that atomically creates:
  - project,
  - service version,
  - allocation rule version,
  - allocation shares,
  - assigned opportunity,
  - approved opportunity assignments,
  - projection version,
  - audit event,
  - idempotency receipt.
- Added configured-mode Supabase read repositories for home, projects, opportunities, members, operational finance, and settlement rails.
- Cut the operating routes to active repositories so configured mode reads canonical Supabase records instead of synthetic operational records.
- Reworked the admin manual contract form to collect client, contract, service scope, projected base, FIRMA23 share, and member assignments.
- Kept projected, approved, and paid money distinct in route models and UI labels.
- Updated tests for configured canonical authority and manual contract setup behavior.
- Extended `scripts/db-verify.sh` with manual setup/RLS/idempotency/immutability checks.

## Exclusions Preserved

- No upload implementation.
- No AI extraction.
- No XP/stat award writes from manual setup.
- No image/media pipeline.
- No connectors.
- No chat/realtime behavior.
- No route redesign.
- No Production, Preview, or deployment action.
- No remote migration application.
- No historical migration rewrites.
- No finance write RPC changes.

## Repair Verification

The preceding repair receipt is bound to clean local candidate
`1f39b620b37a6f2b3701210f0f10a4a70860010f` on
`ui-integrator-merge-six-lanes`:
`.context/qa/ui-integrator/1f39b620b37a6f2b3701210f0f10a4a70860010f/20260826T230516Z-29002`.
Its `head-before.txt` and `head-after-build.txt` match that SHA; both recorded
worktree-status files are empty. This document change requires a subsequent
candidate receipt; do not treat the preceding receipt as proof for a later SHA.

The preceding local receipt recorded these commands with exit 0:

- `git diff --check`, `npm run lint`, `npm run typecheck`, and `npm test`
  (35 files, 406 tests).
- `bash scripts/db-verify.sh`: disposable PostgreSQL 17.10 applied every
  migration and seed from zero; 172 passed and 0 failed.
- Fresh `npm run build`: `BUILD_ID=fqzmhMZT6uK2xpMIpomrI`.
- Local synthetic browser matrix (`mode-s-browser`): exit 0. It covered
  founder/member routes at 375, 767, 768, and 1280px, interaction states, and
  expected 404s. Its result JSON is in the same receipt directory.

The repair coverage includes configured leaderboard/provenance selection,
projection-versus-cash settlement preview semantics, canonical request
serialization, lost-response retry identity, delimiter collision, mismatched
replay, concurrent setup replay, active-membership assignment guards, raw
projection RLS denial, member-scoped calculated financial output, and reversal
correction state behavior.

Unavailable evidence:

- Real Development Supabase create/readback was not run because applying the new migration remotely and creating real canonical records are provider-backed mutations requiring fresh explicit authorization.
- Configured-browser and Development QA remain unavailable: they require an
  authorized remote migration application and real canonical records. The
  passing browser receipt above is explicitly local synthetic-mode evidence,
  not a substitute for configured or Development proof.
- No Production, Preview, deploy, or push evidence exists for this checkpoint.

## Operator Notes

- Configured mode now depends on the additive migration existing in the target Supabase project before the manual setup form can succeed there.
- The manual setup RPC intentionally writes no `cash_events`, `settlements`, `settlement_lines`, `payouts`, or `stat_events`.
- The projection rail is visibly marked as projected and should not be treated as approved or payable money.
- Synthetic mode remains available for local/demo use; configured mode must not rely on synthetic operational records.

## Development-Parity Hardening

- Added additive migration `20260827064837_manual_contract_assignment_visibility_hardening.sql`.
- `assignments_select_self` now requires both the caller's matching member id and
  `is_assigned_to_opportunity(opportunity_id)`, which enforces active membership
  and approved assignment status at the database boundary.
- `manual_contract_setup_request_fingerprint(...)` is now explicitly non-callable
  by `PUBLIC`, `anon`, and `authenticated`; it remains available only inside the
  `SECURITY DEFINER` manual setup RPC.
- The disposable DB harness covers revoked self-assignment visibility denial and
  anonymous fingerprint-helper execution denial. Local verification evidence and
  the resulting exact SHA are recorded by the repair checkpoint; no remote
  migration apply or configured-browser claim is implied.

### Local Verification Before Checkpoint

- Base candidate: `f6d053f0d67a4c8e00250ca6c85155e10e2457fb`, clean before the
  additive migration was generated.
- `npm run lint` and `npm run typecheck` passed.
- `npm test` passed: 35 files and 406 tests.
- Fresh `rm -rf .next && npm run build` passed with
  `BUILD_ID=RRFuSwM8im-sXBM29Kqzg`.
- `bash scripts/db-verify.sh` applied every migration and the seed from zero,
  including this migration, then passed 174 checks with 0 failures.
- No remote migration apply, Supabase call, browser/server run, push, Preview,
  or Production action occurred.
