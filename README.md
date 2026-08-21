# FIRMA23 Ops

Project-agnostic operating network for FIRMA23.

FIRMA23 creates commercial and transformation projects, recruits talent, matches people to opportunities using skills and portfolio evidence, coordinates delivery, approves revenue allocations, and turns verified work into profiles, stats, earnings, and friendly competition.

The Secretaria de Economia digital transformation program is the first real project seeded into the platform. It is not the platform's permanent data model.

This repository is intentionally separate from the FIRMA23 public website.

## Start here

1. Read `AGENTS.md`.
2. Read every file under `docs/`.
3. For UI and UX work on the current prototype, read `docs/M1-HANDOFF.md`.
4. In Conductor, begin with the prompt in `docs/CONDUCTOR-START.md` using Plan Mode.
5. Do not create a production Supabase project or Vercel deployment until the local prototype and financial rules have been approved.

## Running it locally

```bash
npm install
npm run dev
```

No environment variables and no external services are required. The prototype renders entirely from versioned fixture data. Visit `/dev/states` to see every data component in every state.

| Command | Purpose |
|---|---|
| `npm run dev` | Local development server |
| `npm run lint` | ESLint, including the layer-boundary rules |
| `npm run typecheck` | `tsc --noEmit` in strict mode |
| `npm test` | Vitest, non-watch |
| `npm run build` | Production build |

## Current status

Milestone M1 engineering is complete and verified: fourteen routes, three synthetic projects, and the money and allocation core, all running locally with no external services. Visual and interaction polish is the next step; see `docs/M1-HANDOFF.md`.

Cloud state, verified 2026-08-21:

- GitHub repository connected.
- Vercel project `firma23-ops` exists. No deployment has been created.
- Supabase development project `firma23-ops` exists in `us-east-1`, project ref `agsfxtbgwlkcwfyrykfo`.

M1 does not read, modify, migrate, or deploy either cloud resource. The application renders entirely from versioned fixture data with no credentials and no environment variables. Schema work begins in M2 and requires separate approval.
