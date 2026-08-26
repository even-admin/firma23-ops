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

## Verification

Local verification completed before this handoff:

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm test`: pass, 33 files and 403 tests.
- `rm -rf .next && npm run build`: pass. Local build id: `aePKBRzLlyts63JsowtIU`.
- `scripts/db-verify.sh`: pass, disposable PostgreSQL 17.10 from zero, 164 passed and 0 failed.

Unavailable evidence:

- Real Development Supabase create/readback was not run because applying the new migration remotely and creating real canonical records are provider-backed mutations requiring fresh explicit authorization.
- Browser proof against real configured Supabase data was not run for the same reason.
- No Production, Preview, deploy, or push evidence exists for this checkpoint.

## Operator Notes

- Configured mode now depends on the additive migration existing in the target Supabase project before the manual setup form can succeed there.
- The manual setup RPC intentionally writes no `cash_events`, `settlements`, `settlement_lines`, `payouts`, or `stat_events`.
- The projection rail is visibly marked as projected and should not be treated as approved or payable money.
- Synthetic mode remains available for local/demo use; configured mode must not rely on synthetic operational records.
