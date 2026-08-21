# Repository instructions

## Product boundary

This is a private internal operations application. It is not the FIRMA23 public website and must not modify `/Users/racosta/Firma23/site`.

The application records beneficiary companies, package delivery, operator assignments, cash events, allocation approvals, and leaderboard results for the EVEN / Secretaria de Economia program. EVEN may later be absorbed into FIRMA23, so brand and house-recipient names must be data, not hardcoded business logic.

## Required stack

- Next.js App Router with TypeScript in strict mode.
- Tailwind CSS and shadcn/ui primitives.
- Supabase Postgres and invite-only Supabase Auth.
- Row Level Security on every exposed table.
- Vercel as the eventual deployment target.
- Node.js 22 or newer.

Do not add Prisma, Clerk, Stripe, a CMS, microservices, or realtime behavior unless the user explicitly expands scope.

## Safety and money rules

- Never expose a Supabase service-role or secret key to the browser.
- Never use editable user metadata for authorization.
- Founder permissions and operator permissions must be enforced in Postgres RLS, not only in UI code.
- Money is stored as integer centavos, never floating point.
- Never hardcode `$8,972.70`, `$10,000.00`, `$1,600.00`, or a 30/20/50 allocation into UI components.
- Retentions, invoice totals, cash receipts, distributable base, allocation rule, and approved allocations are separate records.
- Unapproved projections must never appear as earned or payable money.
- Approved allocation records are append-only. Corrections use reversal or adjustment entries.
- Every engagement snapshots its package version and allocation rule version.
- Destructive database or deployment actions require explicit user approval.

## Current unresolved business decisions

Do not silently decide these:

1. Whether the current social-content package is 15 pieces or the older 24-piece version.
2. Whether the distributable base is the Secretaria deposit, all cash received, pre-tax service revenue plus beneficiary contribution, or another amount.
3. Whether leaderboard earnings become visible at sale confirmation, delivery approval, or cash receipt.
4. Whether operators see everyone's currency totals or only rank and non-financial performance.

The product must support configuration while these decisions remain open.

## Implementation discipline

- Read all documents under `docs/` before editing code.
- Keep the first milestone local and seeded with synthetic data.
- Prefer one coherent workspace for foundation work. Split workspaces only after the base schema and design tokens are merged.
- Run the narrowest relevant tests after each logical change.
- Keep migrations reviewed, deterministic, and reversible where possible.
- Do not deploy or create paid resources without explicit approval.

