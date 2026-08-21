# Architecture contract

## Application boundary

Build one Next.js application. Supabase owns authentication, Postgres data, and authorization. Vercel will eventually run the application. GitHub is the canonical source repository and Conductor creates isolated workspaces from it.

No custom backend service, payment processor, or autonomous matching service is needed for MVP.

## Proposed tables

| Table | Purpose |
|---|---|
| `organizations` | FIRMA23 and future operating organizations |
| `profiles` | Member display information linked to Supabase Auth UUID |
| `memberships` | Organization role, invitation, and active status |
| `skills` | Normalized skill catalog |
| `member_skills` | Member skill level and verification status |
| `portfolio_items` | Links, media metadata, role, and evidence |
| `projects` | Project-agnostic commercial programs such as SETY 2026 |
| `project_members` | Membership and permissions inside one project |
| `service_versions` | Immutable project-specific service definitions |
| `milestone_templates` | Ordered workflow for each service version |
| `opportunities` | Customer, beneficiary, or paid work unit |
| `assignments` | Member, role, delivery weight, and assignment status |
| `opportunity_milestones` | Materialized execution checklist |
| `evidence_links` | Delivery URLs and metadata |
| `cash_events` | Invoice, withholding, deposit, contribution, adjustment, payout |
| `allocation_rule_versions` | Versioned house, closer, delivery, and custom role rules |
| `settlements` | Founder approval boundary for an opportunity |
| `settlement_lines` | Append-only allocations per recipient |
| `stat_events` | Append-only events used to compute member stats |
| `audit_events` | Actor, action, target, timestamp, and safe change summary |

Money uses integer minor units with an explicit ISO currency. Percentages and weights use basis points where 10,000 equals 100 percent.

## Authorization

### Founder administrator

- Manage organization, projects, service versions, opportunities, members, and rules.
- View full cash and settlement detail.
- Approve assignments, delivery, settlements, reversals, and adjustments.

### Member

- Read projects and opportunities exposed to the member.
- Edit their profile, skills, availability, and portfolio claims.
- Read assigned opportunities and update assigned milestones or evidence.
- Read their own settlement lines.
- Read leaderboard fields allowed by organization policy.
- Never approve their own financial lines or edit derived stats.

## Matching boundary

MVP matching is explainable filtering and ranking, not autonomous AI:

- Required skills.
- Verified portfolio tags.
- Availability.
- Prior completed assignments.
- On-time rate.
- Optional founder-entered notes.

The founder makes the final assignment. Future AI recommendations must retain human approval and explanation.

## Required invariants

1. Every exposed table has RLS enabled before browser access.
2. A member cannot edit derived earnings or performance stats.
3. Service and allocation-rule versions used by opportunities are immutable.
4. Settlement lines cannot exist without a founder-approved settlement.
5. Settlement lines sum exactly to the approved distributable base.
6. Weighted assignment pools total exactly 10,000 basis points before approval.
7. Corrections append reversals or adjustments instead of rewriting approved history.
8. Leaderboards distinguish projected, approved, and paid values.
9. Project-specific rules never become global platform constants.
10. Duplicate submissions are idempotent at the database boundary.

## Milestones

### M1: Local network shell

- Next.js TypeScript scaffold.
- Synthetic data only.
- Personal home, opportunity board, member profiles, leaderboard, project detail, and founder finance view.
- SETY appears as one seed project among data-driven projects.
- Responsive behavior plus loading, empty, error, and permission states.
- No external Supabase or Vercel resources required to render locally.

### M2: Supabase foundation

- Approved Supabase project.
- Migrations, seed, Auth, RLS, and authorization tests.
- Replace synthetic repositories with Supabase queries.

### M3: Projects and assignments

- Project and service-version management.
- Opportunity creation.
- Profile, skills, portfolio, and availability.
- Explainable assignment filters and founder approval.

### M4: Execution and settlements

- Milestones and evidence.
- Cash-event ledger.
- Configurable allocation rules.
- Settlement preview, approval, reversal, payout status, and derived stats.

### M5: Release candidate

- End-to-end role tests.
- Responsive and accessibility QA.
- Founder acceptance.
- Preview deployment first. Production requires separate approval.
