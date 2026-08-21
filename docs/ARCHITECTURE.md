# Architecture contract

## Application

Build one Next.js application with server-rendered authenticated routes and a small client-side interaction layer. Supabase owns authentication, Postgres data, and authorization. Vercel will eventually run the application.

No custom backend service is needed for the MVP.

## Proposed tables

| Table | Purpose |
|---|---|
| `organizations` | Stable operating entity; supports EVEN to FIRMA23 transition |
| `profiles` | Display information linked to Supabase Auth UUID |
| `memberships` | Organization role and active/invited status |
| `package_versions` | Immutable commercial package definitions |
| `package_step_templates` | Ordered checklist for each package version |
| `companies` | Beneficiary companies |
| `engagements` | A company receiving one package-version snapshot |
| `engagement_steps` | Materialized operational checklist and status |
| `engagement_assignments` | Closer and delivery contributor assignments |
| `evidence_links` | Delivery URLs and metadata, no file storage in milestone one |
| `cash_events` | Invoice, withholding, deposit, contribution, and adjustment events |
| `allocation_rule_versions` | Versioned house, closer, and delivery rules |
| `settlements` | Approval boundary for one engagement |
| `settlement_lines` | Append-only payable allocations per recipient |
| `audit_events` | Actor, action, target, timestamp, and safe change summary |

All monetary columns use integer centavos. Percentage or weight values use basis points where 10,000 equals 100 percent.

## Authorization

### Founder administrator

- Read and write all rows within the organization.
- Invite and deactivate members.
- Manage package and allocation-rule versions.
- Approve, reverse, and adjust settlements.
- View all financial lines.

### Operator

- Read the package catalog and active team display data.
- Create companies and engagements.
- Read engagements where they are creator, closer, or contributor.
- Update assigned operational steps and evidence.
- Read their own settlement lines.
- Read the leaderboard projection allowed by organization policy.
- Never approve settlements, edit rules, or read hidden line-item payouts for others.

## Required invariants

1. Every exposed table has RLS enabled before browser access.
2. Every update policy has both ownership checks and valid `WITH CHECK` behavior.
3. Package versions used by engagements are immutable.
4. Settlement lines cannot exist without a founder-approved settlement.
5. A settlement's lines sum exactly to its approved distributable base.
6. Contributor weights total exactly 10,000 basis points before approval.
7. A settlement correction appends a reversal or adjustment. It never rewrites approved history.
8. Leaderboards distinguish projected, approved, and paid values.
9. Duplicate submissions are idempotent at the database boundary.

## Milestones

### M1: Local product shell

- Next.js TypeScript scaffold.
- FIRMA23 Ops design tokens.
- Synthetic seed data only.
- Operator dashboard, operations queue, engagement detail, admin finance view.
- Responsive behavior and empty/loading/error states.
- No external Supabase or Vercel resources.

### M2: Supabase foundation

- Local or explicitly approved hosted Supabase project.
- Migrations, seed, Auth, memberships, RLS, and authorization tests.
- Replace synthetic repository with Supabase queries.

### M3: Operational workflow

- Create company and engagement.
- Materialized package steps.
- Contributor assignments and evidence links.
- State transition validation.

### M4: Financial approvals

- Cash-event ledger.
- Configurable allocation rules.
- Settlement preview, approval, reversal, and leaderboard.
- Exact rounding and invariant tests.

### M5: Release candidate

- End-to-end role tests.
- Responsive and accessibility QA.
- Explicit founder acceptance.
- Only then create or connect production deployment resources.

