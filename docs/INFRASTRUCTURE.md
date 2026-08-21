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
- No deployment has been created yet.

Vercel generated an ignored `.env.local` containing local project credentials. Never commit or print that file. Git integration should create preview deployments only after the application exists and a non-production branch is pushed.

## Supabase

Pending a separate `FIRMA23` organization. The currently connected Supabase account exposes only the `ATIAL` organization, which is intentionally out of scope for this project.

Before creating the Supabase project:

1. Create or connect the `FIRMA23` organization.
2. Query and show the exact recurring project cost.
3. Obtain explicit cost confirmation.
4. Create the project in `us-east-1` unless a better approved region is selected.
5. Do not apply schema until the M2 migration is reviewed.
