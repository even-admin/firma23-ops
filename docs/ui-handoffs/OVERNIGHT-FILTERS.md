# Overnight filter instrument handoff

- Base: `51a56f049482997e1b42130c2186acac32b4b6cf`
- Branch: `overnight-ui-ops`
- Ownership: `src/components/filter/FilterChips.tsx` only.

## Delivered

Converted the shared filter tray from a warm raised/pill treatment to a precise
black/white/neutral segmented instrument. Active links are black with white
text; inactive links retain neutral hover and a visible keyboard focus ring.
Counts are squared instrument counters. URL query preservation, link behavior,
`aria-current`, and 44px minimum targets are unchanged.

## Evidence

- `git diff --check`: PASS.
- Independent read-only review: no blocker/high/medium finding.
- Focused Vitest, lint, and typecheck: UNAVAILABLE. This new clean worktree has
  no installed dependency executables (`vitest`, ESLint, TypeScript); no install
  was performed.

No remote action, deployment, migration, or credential use occurred.
