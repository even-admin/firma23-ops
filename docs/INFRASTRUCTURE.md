# Infrastructure state

Verified on 2026-08-21.

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
- No deployment has been created. M1 must not create one.

Vercel generated an ignored `.env.local` containing local project credentials. Never commit or print that file. Git integration should create preview deployments only after the application exists and a non-production branch is pushed.

## Supabase

- Development project: `firma23-ops`.
- Region: `us-east-1`.
- Project ref: `agsfxtbgwlkcwfyrykfo`.

The project exists and is empty. No schema, migration, seed, or Row Level Security policy has been applied.

M1 must not access, modify, migrate, or deploy this project. The local prototype renders from versioned fixture data and requires no Supabase credentials.

Before the first migration in M2:

1. Confirm the organization and the exact recurring project cost.
2. Review the migration for the invariants in `ARCHITECTURE.md`, in particular Row Level Security on every exposed table.
3. Obtain explicit approval to apply schema.
4. Keep a production project separate from this development project.
