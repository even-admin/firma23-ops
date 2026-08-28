# Finance approval control

## Candidate

- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/overnight-ui-ops`
- Branch: `overnight-ui-ops`
- Base: `2b8a215c09a1ec1a89b9ee8b57b3f115eeff55c4`
- Scope: founder settlement approval UI only; local code only.

## What changed

The settlement review route now exposes a real approval control. Its Server
Action resolves the viewer from the server session and calls the existing active
settlement repository. The browser submits only the opportunity id and a stable
idempotency key. It never submits a base, allocation, recipient, currency, or
settlement line; `approve_settlement` derives those facts in Postgres from the
snapshotted allocation rule, confirmed cash events and approved assignments.

The control is available only after the visible readiness checks pass, is
disabled after authoritative approval until the route refreshes, preserves the
same key across error/unavailable retries and reloads, and focuses an announced
outcome. With Supabase unconfigured, the existing synthetic repository returns
`unavailable`; the UI does not claim a settlement exists.

## Deliberately not included

- Recording confirmed cash events.
- Recording payouts or historical payout reallocations.
- Reversing a settlement.
- Any amount, allocation, or rule editing surface.
- Any migration, remote Supabase apply, push, Preview, or deployment.

Cash and payout controls need a separate reviewed read model for valid event
types and unpaid settlement-line identities. They must not be improvised from
the Revenue Rail, whose participant data is presentation data rather than a
payout command surface.

## Verification

- `npm run lint`: pass.
- `tests/components/approve-settlement-control.test.tsx`: `5/5` pass.
- `tests/data/finance-write.test.ts`: `16/16` pass.
- `scripts/db-verify.sh`: existing finance authority scenarios pass.
- Full typecheck/build and full suite remain subject to the pre-existing
  MeshDrift type error and IdentityOrb palette snapshot mismatch; this unit does
  not touch either surface.

## Review focus

Check that the action has no client-supplied authority, retries retain their
idempotency key, synthetic mode cannot fake success, and the UI's readiness
checks are presentation guidance rather than a replacement for Postgres rules.
