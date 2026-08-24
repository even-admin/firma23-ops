# Infrastructure state

Verified on 2026-08-24.

## GitHub

- Canonical private repository: `https://github.com/even-admin/firma23-ops`.
- Default branch: `main`.
- GitHub Project: `https://github.com/users/even-admin/projects/1`.
- Issues 1 through 5 define milestones M1 through M5.

GitHub is the source authority for Conductor local and cloud workspaces.

## Conductor

- Shared repository settings: `.conductor/settings.toml`.
- Local workspaces copy only ignored `.env.local` variants listed in `.worktreeinclude`.
- Cloud workspaces clone tracked files from the private GitHub repository and run `scripts.setup`.
- Start from issue 1 or use the prompts in `docs/CONDUCTOR-START.md`.

Do not start parallel foundation workspaces. M1 shares application structure, data contracts, and design tokens.

## Vercel

- Team: `luisalbertoracosta-gmailcoms-projects`.
- Project: `firma23-ops`.
- Git repository: `even-admin/firma23-ops`.
- Local link metadata is stored under ignored `.vercel/`.
- Merging PR #6 caused the existing Git integration to deploy merge commit
  `aea5eb3ce29f42681b0332dac584b1302f8abd55` to Production automatically.
  No production deployment command was run during the Supabase activation.
- Development and Preview contain only
  `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the canonical development
  project. No service-role or secret key was added to either environment.
- Production still contains the older Supabase/Postgres variable set created
  before canonical-project activation. It was not read, removed, replaced, or
  redeployed in this pass. Treat Production as isolated and unverified until a
  separately authorized infrastructure change removes that legacy coupling.

The ignored `.env.local` contains the canonical public Development variables
and the existing Vercel OIDC value. Never commit or print that file. Further
merges to `main` can trigger Production and require explicit deployment
authorization or a prior change to the Git deployment policy.

## Supabase

- Development project: `firma23-ops`.
- Region: `us-east-1`.
- Project ref: `agsfxtbgwlkcwfyrykfo`.

The reviewed M2/P3 schema and deterministic M1 seed are now applied to this
development project only:

- 27 public application tables, all with RLS enabled.
- Private `source-documents` storage bucket and founder-only policies.
- Audited intake and finance RPCs, including reversal and payout boundaries.
- Explicit Data API least-privilege grants: `anon` has no access to the public
  schema; `authenticated` has only the operations represented by reviewed RLS
  policies; finance/stat writes remain RPC-only.
- Function search paths are pinned. Security advisors report no error or
  critical finding; the remaining warnings identify the intentional
  authenticated `SECURITY DEFINER` RPC/helper boundary.
- Seeded data mirrors the repository fixtures, including the SETY base of
  897,270 centavos and exact 30/20/50 allocation.

The MCP write path records the deterministic seed as migration
`seed_m1_synthetic_data`; the seven original migration names retain their
repository timestamps inside their recorded names. Later deployment tooling
must reconcile by migration name, not assume the remote-generated version is
the filename timestamp.

Four more migrations followed on 2026-08-24 (Data API grants, PUBLIC
privilege hardening, `authenticated` least privilege, function search-path
pinning), bringing the project to **13 applied migrations total** as of
2026-08-24 (`list_migrations` is the source of truth — re-check it before
trusting any number written here). The 13th and latest is
`invite_founder_luis_ramirez` (below).

### Policy: real identity data never goes in `supabase/migrations/**`

`supabase/migrations/**` is replayed from zero by `scripts/db-verify.sh`
against a disposable local Postgres instance — every row it creates must be
synthetic and safe to regenerate. Real bootstrap/identity data (an actual
invite, an actual email) is applied directly to the remote project via the
MCP `apply_migration` tool, under a descriptive name, and recorded here —
never added as a repo migration file, and never replayed by the local
harness. This is a standing policy, not a one-off: any future real invite,
real identity link, or similar bootstrap action follows the same path.
`apply_migration` is invoked only with the user's explicit authorization
per change; none has been made beyond what is logged below.

**2026-08-24, one `apply_migration` call, named `invite_founder_luis_ramirez`:**
one `member_invites` row linking the already-seeded founder member (Luis
Ramírez, `b0000000-0000-4000-8000-000000000001`) to
`contacto@luisracosta.com`, expiring 14 days out. No other remote change has
been made since. Nothing has been reverted — reverting would itself be a
remote data change requiring the same authorization.

**Current state, verified 2026-08-24 (real, not simulated):** the person
holding that invite completed the full login flow through the actual
`/login` → magic-link email → `/auth/callback` path against this exact
repository code — not a test script, not a fabricated identity. `auth.users`
holds one row for `contacto@luisracosta.com`; `auth.sessions` shows a real
established session; `members.auth_user_id` is linked; `memberships.status`
is `active` with `activated_at` set. `redeem_invite()` ran for real and
produced the state its own return contract promises. This is the first and
only real identity in the system — no second one was created to test
anything.

Hosted anonymous Data API/table/RPC access returns 401 (verified directly
against `/rest/v1/members` and `/rest/v1/rpc/redeem_invite` with the
publishable key, no session). `anon` has `execute` on none of the six
authenticated-only RPCs; `authenticated` has it on all six
(`has_function_privilege` checked directly). RLS policies on
members/memberships/cash_events/settlements/settlement_lines match the
reviewed migrations exactly (`pg_policies` checked directly). The full local
RLS/RPC/Auth harness passes 151 scenarios against the identical schema (see
"M2 Auth repair" below for the 14 that specifically exercise
`redeem_invite()` — none of the earlier 137 did).

No second identity was created to test the founder path end to end — the
founder path was proven with the one real identity that exists
(`redeem_invite()`'s effect above), not a fabricated one. `is_active_founder()`
is now true for that real, established session.

One caveat worth stating plainly: a real, invited founder session
authenticates for real, but the sidebar/finance chrome in
`src/app/(network)/layout.tsx` still reads `syntheticProjectRepository` and
`syntheticFinanceRepository` directly, not the Supabase-backed adapters
behind `active/`. M2 Auth landed the auth boundary — real session, real
`redeem_invite()`, real RLS-enforced role — but not the repository read-swap
for nav/finance data, which remains separate, already-deferred M3+ work. Do
not describe M2 as "the app now runs on the real backend" without this
qualifier: today it is real auth over synthetic demo data for everything
except the finance write RPCs (P3), which were already real.

Security advisors were re-checked after the invite insert: no new finding.
The pre-existing `authenticated_security_definer_function_executable`
warnings are the same intentional RPC/helper boundary already documented
above. One warning is new to this review but unrelated to this change:
`auth_leaked_password_protection` (HaveIBeenPwned check for password auth) —
not applicable, since this product never uses password auth, only magic
link/OTP.

### M2 Auth repair (adversarial review, `.context/architecture-council/m2-auth-adversarial-review.md`)

Two HIGH findings closed, both fail-closed corrections, no remote change:

- **H1 — missing Supabase env vars used to fail open to a founder.**
  `isSyntheticModeAllowed()` (`src/lib/backend.ts`) now gates the entire
  synthetic-viewer fallback: a Vercel Preview or Production deployment
  missing its `NEXT_PUBLIC_SUPABASE_*` vars gets `backend-unavailable`, never
  the prototype viewer. Verified against a real production build
  (`VERCEL=1`, empty Supabase vars): `/admin` and `/` both redirect to
  `/login?state=backend-unavailable`, no founder content, no redirect loop.
  The prototype viewer's own default is also now least-privilege: no cookie,
  or any value other than the literal `'founder'`, resolves to `member`.
- **H2 — a revoked membership kept reporting `'redeemed'`.** Corrected via a
  new, additive migration
  (`20260824080000_redeem_invite_membership_authority.sql`) — see below.

`scripts/db-verify.sh` now runs `redeem_invite()` for real, under
`set role authenticated` + `request.jwt.claim.sub`, exactly like the
finance RPCs already were (scenario 20/20b, 14 scenarios): authenticated
with no invite, a valid pending invite, replay after redemption, an expired
invite, case-insensitive email matching, a revoked membership, an
unauthenticated call, and 20 concurrent first-redemption calls (exactly one
audit row, one active membership, zero errors).

**Deferred, not built in this pass:** a founder-facing revoke/re-issue
invitation flow. `member_invites` has no `update`/`delete` policy and no
revocation column today — a founder cannot revoke or re-issue an invite from
any exposed path. Adding that requires a schema change (e.g. a
`revoked_at` column and an audited `revoke_invite()`/`reissue_invite()` RPC
pair) and is out of scope here by explicit instruction; this is a known gap,
not an oversight.

The earlier project `dexyfkecgyfikvxwcopv` is noncanonical and remains outside
this repository's database/migration boundary. No schema or data operation may
target it.
