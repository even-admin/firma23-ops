# UI spatial identity handoff

## Objective

Replace rigid profile placeholders with a durable FIRMA23 identity treatment and
soften the member/project presentation without weakening the record hierarchy.
This pass also closes the three correctness findings that were open at the start
of the work.

## Provenance

- Branch: `ui-integrator-merge-six-lanes`.
- Starting SHA: `0d4392b25ab4ed9ca7ac5c2b01932ef17cdcf312`.
- Correctness repair: `0adec50` (`fix(ui): close member and project composition gaps`).
- Delivery SHA: the commit containing this handoff and the spatial identity implementation.
- No remote, deployment, Supabase, dependency or credential action was performed.

## Delivered

- `IdentityOrb` is a decorative circular member marker derived deterministically
  from `memberId`. It has six tokenized palettes, no initials, image, runtime
  randomness, remote asset, dependency or semantic colour meaning.
- The orb appears on the member profile/directory, Home identity header,
  leaderboard rows, opportunity assignment rows and member Revenue Rail
  segments. Surfaces without a stable member id deliberately keep their neutral
  fallback instead of hashing display names.
- Member cards use a more spatial header, larger internal rhythm and quiet skill
  chips while preserving dense scanability and the existing data contract.
- Projects use rounded record chambers and switch between structured rows and a
  semantic table at an 864px content-container threshold. This prevents the
  expanded desktop sidebar from forcing six columns into an undersized chamber.
- The user-profile-card reference contributed hierarchy only. Glass, blur,
  photos, remote avatars and foreign dependencies were rejected.
- The avatar-with-name reference contributed the orb/name relationship only.
  Its image and demo styling were not imported.

## Correctness repairs

- Dual-role member earnings now correlate a settlement participant by both
  assignment role key and member id.
- Home active-work count now reports distinct opportunities instead of assignment
  rows.
- Project records respond to available container width, with browser assertions
  for containment, cell separation and the 768px expanded-sidebar composition.

## Invariants

- Orb colour is decorative: never role, status, rank, availability, earnings or
  completion.
- Ledger green, attention amber and failure red are absent from orb palettes.
- Money still renders through `Amount`; projected and approved class boundaries
  are unchanged.
- No runtime dependency, view model, domain type, repository interface or route
  contract was added.
- `MeshDriftCanvas` remains the Home environment exception. `IdentityOrb` is the
  only additional, bounded gradient exception.

## Verification

- Focused UI suite: 87 tests passed.
- Full unit suite: 380 tests passed.
- Disposable PostgreSQL harness: 153 scenarios passed.
- Lint, strict typecheck and production build passed.
- Independent uncommitted review: no actionable defects.
- Chromium acceptance on the complete source tree: 96 route/role/viewport cells
  and 70 interaction receipts passed at 375, 767, 768 and 1280px.

The final exact-SHA gate must run after this file is committed. Its ignored
candidate-scoped receipts, rather than this tracked summary, are authoritative.
