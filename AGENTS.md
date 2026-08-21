# Repository instructions

## Product boundary

This is a private operating network and future talent community. It is not the FIRMA23 public website and must not modify `/Users/racosta/Firma23/site`.

The platform is project-agnostic. FIRMA23 creates projects and paid opportunities, recruits members, records skills and portfolio evidence, assigns closers and delivery contributors, coordinates work, approves settlements, and produces trustworthy earnings and performance stats. The EVEN / Secretaria de Economia program is the first seed project, never a platform-level assumption.

EVEN may later be absorbed into FIRMA23, so brands, project sponsors, service catalogs, and house recipients are data, not hardcoded business logic.

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
- Never hardcode a specific project's financial rules into UI components.
- Retentions, invoice totals, cash receipts, distributable base, allocation rule, and approved allocations are separate records.
- Unapproved projections must never appear as earned or payable money.
- Approved allocation records are append-only. Corrections use reversal or adjustment entries.
- Every opportunity snapshots its service version and allocation rule version.
- Destructive database or deployment actions require explicit user approval.

## Confirmed SETY seed-project rule

For the supplied SETY example, the official distributable base is only the Secretaria bank deposit:

- Distributable base: 897,270 centavos (`$8,972.70`).
- House participation: 269,181 centavos (`$2,691.81`, 30 percent).
- Closer: 179,454 centavos (`$1,794.54`, 20 percent).
- Delivery pool: 448,635 centavos (`$4,486.35`, 50 percent).

The official Secretaria images define the SETY packages. The PDF is reference material but does not override those images.

## Product defaults still requiring validation

- Earnings count toward the leaderboard only after settlement approval. Keep projected and paid values separate.
- Operators may see team rank and approved earnings totals in the initial prototype. Founders retain access to line-item financial detail.
- Opportunity assignment remains founder-controlled in MVP. Self-application and marketplace mechanics are later phases.

## Implementation discipline

- Read all documents under `docs/` before editing code.
- Keep the first milestone seeded with synthetic data and runnable without external services.
- Prefer one coherent workspace for foundation work. Split workspaces only after the base schema and design tokens are merged.
- Run the narrowest relevant tests after each logical change.
- Keep migrations reviewed, deterministic, and reversible where possible.
- Do not deploy or create paid resources without explicit approval.
