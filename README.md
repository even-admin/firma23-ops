# FIRMA23 Ops

Project-agnostic operating network for FIRMA23.

FIRMA23 creates commercial and transformation projects, recruits talent, matches people to opportunities using skills and portfolio evidence, coordinates delivery, approves revenue allocations, and turns verified work into profiles, stats, earnings, and friendly competition.

The Secretaria de Economia digital transformation program is the first real project seeded into the platform. It is not the platform's permanent data model.

This repository is intentionally separate from the FIRMA23 public website.

## Start here

1. Read `AGENTS.md`.
2. Read every file under `docs/`.
3. In Conductor, begin with the prompt in `docs/CONDUCTOR-START.md` using Plan Mode.
4. Do not create a production Supabase project or Vercel deployment until the local prototype and financial rules have been approved.

## Current status

Milestone M1 is in progress. The Next.js application, dependencies, design tokens, and the money and allocation core exist and run locally on synthetic data.

Cloud state, verified 2026-08-21:

- GitHub repository connected.
- Vercel project `firma23-ops` exists. No deployment has been created.
- Supabase development project `firma23-ops` exists in `us-east-1`, project ref `agsfxtbgwlkcwfyrykfo`.

M1 does not read, modify, migrate, or deploy either cloud resource. The application renders entirely from versioned fixture data with no credentials and no environment variables. Schema work begins in M2 and requires separate approval.
