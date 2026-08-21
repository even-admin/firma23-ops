# Start in Conductor

## First experiment

Use one local workspace. Foundation work shares schema, UI contracts, and application state, so parallel branches would create avoidable conflicts.

1. Open `/Users/racosta/Firma23/firma23-ops` as a local repository in Conductor.
2. Create one new workspace from `main`.
3. Select Codex.
4. Enable Plan Mode.
5. Paste the planning prompt below.

## Planning prompt

```text
Read AGENTS.md and every file under docs/ before doing anything else.

We are building FIRMA23 Ops, a project-agnostic operating network and future talent community for FIRMA23. SETY 2026 is the first seed project, not the application architecture. This is a greenfield repository. Your task in this turn is planning only. Do not create files, install dependencies, change cloud resources, or deploy.

Produce an implementation plan for Milestone M1: Local network shell. The plan must name the routes, component boundaries, synthetic data contracts, design tokens, test layers, exact verification commands, and stopping conditions. Project-specific rules must remain versioned data. Do not treat projected allocations as approved earnings.

Optimize for a polished same-day prototype that can later accept the Supabase schema without rewriting the UI. End with the smallest reviewable first coding slice.
```

Review the plan. If it respects the boundaries, switch the same workspace out of Plan Mode and paste the build prompt.

## Build prompt

```text
Implement Milestone M1 from the approved plan.

Build the local product shell with synthetic data only. Do not create external services, deploy, or add credentials. Use strict TypeScript, the required stack in AGENTS.md, the design direction in docs/DESIGN-DIRECTION.md, and the data contracts in docs/ARCHITECTURE.md.

The result must include the personal home, opportunity board, member directory and profiles, project detail, opportunity detail with the Revenue Rail, leaderboard, and founder finance view. SETY 2026 must appear as a data-driven seed project using the confirmed `$8,972.70` distributable base and exact 30/20/50 sample allocation. Show projected, approved, and paid states distinctly. Include loading, empty, error, focus, disabled, and responsive states. Use realistic synthetic companies and avoid real contact information.

Run lint, typecheck, tests, and a production build. Start the dev server with the Conductor run action and inspect the primary desktop and mobile flows. Stop after M1 is working and report all changed files, commands run, remaining risks, and any product assumptions. Do not begin schema work.
```

## When to split workspaces

After M1 is reviewed and merged to `main`, separate workspaces can own independent units:

| Workspace | Ownership | Can start when |
|---|---|---|
| `supabase-foundation` | Migrations, seed, Auth, RLS tests | M1 data contracts are merged |
| `projects-assignments` | Profiles, skills, projects, opportunities, assignment filters | Supabase schema is merged |
| `execution` | Milestones, state transitions, evidence links | Projects and assignments are merged |
| `finance-ledger` | Cash events, rules, settlements, rounding tests | Project rules are confirmed |
| `visual-qa` | Responsive, accessibility, design polish | A runnable integrated branch exists |

Do not assign two workspaces the same foundation files. Use Conductor's Diff Viewer before merging each branch.
