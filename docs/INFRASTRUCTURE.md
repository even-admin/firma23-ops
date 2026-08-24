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

Auth remains invite-only and intentionally unbootstrapped: there are zero Auth
users and zero active memberships. Hosted anonymous Data API/table/RPC access
returns 401, and the full local RLS/RPC/Auth harness passes 137 scenarios. A
positive hosted `redeem_invite()` test requires the first real invited identity
and must not be simulated with an invented email.

The earlier project `dexyfkecgyfikvxwcopv` is noncanonical and remains outside
this repository's database/migration boundary. No schema or data operation may
target it.
