# Crew audit-read repair

## Candidate

- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/overnight-ui-ops`
- Branch: `overnight-ui-ops`
- Base: `8c2e4c71b7534ce7ce1cb185dd6190b5b392ca5c`
- Scope: close the crew receipt audit-read finding only. No remote action.

## Repair

`opportunity_crew_receipts` already had founder-only RLS, but the table was
created after the repository's least-privilege table-grant migration. RLS alone
does not make a table reachable through Supabase's authenticated Data API.

The unapplied crew migration now revokes `PUBLIC`/`anon` access and grants only
`SELECT` to `authenticated`; its existing founder-only RLS policy remains the
row authority. The crew repository reads immutable receipts only for founders,
and the founder-only opportunity detail shows a collapsed, read-only before and
after trail using pool labels and known member names. Synthetic mode renders an
honest empty history because no synthetic receipt exists.

The repair does not add a write path, alter assignment/settlement/projection
semantics, expose money, create identities, apply migrations, push, deploy, or
touch Supabase/Vercel.

## Verification

- `npm run lint`: pass.
- Focused component tests: `16/16` pass (`CrewManager` plus the new history
  component).
- `scripts/db-verify.sh`: pass with founder-read, member-zero-row, and
  anon-denial checks for the receipt table.
- `npm run typecheck` and `npm run build`: still fail only on the pre-existing
  `mesh-drift-config.ts` optional palette value error.
- Full `npm test`: `431/432` pass; the unchanged failure is the pre-existing
  `red-operator-identity` palette-byte snapshot mismatch.

## Review focus

Confirm that the new explicit table grant is constrained by founder RLS, that
member/anon access remains blocked, and that the history surface cannot imply a
financial event or mutate crew state.
