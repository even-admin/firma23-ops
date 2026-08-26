# FIRMA23 UI control checkpoint — 2026-08-26

## Resume target

- Active worktree: `/Users/racosta/conductor/workspaces/firma23-ops/abuja`
- Branch: `ui-integrator-merge-six-lanes`
- Code checkpoint: `e46597a6be4a20cc8176325ee133cfad9db2bc4a`
- Merge-base with `origin/main`: `67bac0a5c0949c0f1c2d11de20c8a2af33959d7d`
- Delivery HEAD: the commit containing this handoff, directly above the code checkpoint.
- Remote state: no push, PR, merge, Preview, Production, Supabase or Vercel write
  was performed for these commits.

Do not resume in the Jerusalem worktree. It has an unrelated pre-existing local
edit to `docs/INFRASTRUCTURE.md` on branch `ui-launch-contract`; preserve it.

## Landed local commits

1. `d932f16` — personal performance command strip and repository-backed event
   history.
2. `8dad9be` — direct Progress Metric Card fidelity repair: 28px hairline surface,
   62% masked dot field, restrained tokenized tint, 2px curve, narrow bars and
   neutral controls.
3. `e46597a` — Network carousel refinement and display-language update.

The worktree was clean before this handoff-only commit.

## Current product behavior

- Display navigation reads `Home`, `Contracts`, `Network` and `Performance`.
  Existing routes remain `/`, `/opportunities`, `/network` and `/leaderboard`.
- Home retains the exact approved moving `MeshDriftCanvas` identity field.
- The performance chart uses only repository-backed events. The synthetic member
  presently has one approved settlement, so the chart shows a truthful
  baseline-to-event curve and disables event bars. Do not invent the reference's
  wavy stock history.
- Projection has no line and contains zero `money` classes.
- Network has no outer top/bottom framing rules or filter rail.
- Adjacent Network cards are 44px-plus selection controls. Clicking one centers
  it and reveals the detailed face; only the centered card links to the profile.
- Arrow keys, Home/End, bare side pointers and swipe remain supported.
- Adjacent-card hover lifts the inner card by 4px; reduced motion removes it.

## Interaction decision pending

Luis asked for a proposal before adding a flip or expansion treatment. The
recommended model is **focus reveal, not a 180-degree flip**:

1. Side-card click moves the member to the center.
2. The centered card exposes the full performance face.
3. A click on the centered card opens the profile.
4. Do not add a literal card flip unless Luis explicitly overrides this proposal.

The first three behaviors are already implemented. No extra flip effect landed.

## Verification at the code checkpoint

- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm test` — 403 tests pass across 33 files.
- `npm run build` — pass; 16 listed routes including dynamic detail routes.
- `git diff --check` — pass.
- Earlier DB verification remains 153/153; the commits above are presentation,
  copy, view-history and synthetic-read changes only, with no migration edit.
- Safari desktop smoke: `/` and `/network` returned 200 at
  `http://127.0.0.1:55131`; chart material, labels and side-card selection were
  inspected visually.
- Exact 375/767/768/1280 final captures remain unverified. Do not relabel the
  desktop Safari smoke as responsive acceptance.

## Highest-value continuation

1. Start one new control workspace from the exact tracked handoff HEAD. Do not
   run two live agents in the same worktree.
2. Reconstruct exact branch/SHA/clean status before edits.
3. Run exact-width browser QA on Home and Network first, including keyboard,
   reduced motion, horizontal overflow and the 767/768 transition.
4. Present the current focus-reveal behavior to Luis. Add no flip until approved.
5. Keep the control model on architecture/review. Delegate bounded route-local
   visual repairs to smaller models with exclusive file ownership and commit-only
   handoffs.

## Known product gaps outside this visual checkpoint

- Real PDF/DOCX contract extraction is not implemented; filename upload is not a
  parsing pipeline. Do not claim AI intake works on real contracts.
- XP/player progression remains deferred until versioned authoritative
  `xp_events` exist. Telemetry, commits and token usage do not create XP.
- Most route reads remain synthetic; configured Auth does not make those records
  canonical Supabase data.
- SMTP/Auth provider state must be re-verified from authoritative controls before
  another OTP attempt. A failed attempt is evidence, not retry authorization.

## Non-negotiable invariants

- Every amount uses `Amount` and tabular numerals.
- Projected money never appears approved or paid and contributes no ranking.
- Ledger green is only confirmed money or primary completion.
- Financial authority remains append-only and outside visual components.
- No component imports `src/data/**`.
- No new runtime dependency, fake metric, fake person, remote avatar or generic AI
  artwork.
- No remote action, deployment, migration or credential operation without fresh
  explicit authorization.
