# UI-STUDIO-DIRECTION handoff

## Provenance

- Branch: `ui-integrator-merge-six-lanes`.
- Starting SHA: `9c5c05a8fdad80b1c80de68cff7289c3ab2652ef`.
- Implementation SHA: `72bf48725499fe61ca6f87467ecbc78713a4d854`.
- Acceptance repair SHA: `1bc6b67c841a7f79e87378badc73dd37d14ea339`.
- Starting worktree: clean.
- Runtime dependencies added: none.
- Remote writes, deploys, Supabase changes, credentials, and external resources: none.

## Accepted direction

FIRMA23 now presents as a young creative studio first and a private members club
second: editorial atelier in its records, spatial software in its identity and
project environments. Home follows a focused-center/active-periphery composition.
The interface uses a four-level radius hierarchy: 12px authority records and
controls, 16px member/project objects, and 20px focused objects.

Three bounded decorative gradients are allowed and documented:

1. Home's `MeshDriftCanvas` project field.
2. The deterministic member `IdentityOrb`.
3. The deterministic editorial `ProjectCover`.

They never encode status, permission, rank, earnings, approval, or connector
health. Finance and settlement remain neutral authority surfaces.

## Implementation

- Rebuilt Home around one real active assignment, its matching next action, and
  a separate private ledger. Member presentation never links into founder-only
  opportunity routes.
- Removed unsupported XP/progression UI and its synthetic derivation. Verified
  outcomes remain visible; game progression waits for authoritative versioned
  `xp_events`.
- Kept member discovery as an accessible coverflow with deterministic gradient
  orbs and approved earnings only. The orbs now use the same WebGL mesh field,
  grain and motion as Home across five approved palettes, replacing the rejected
  CSS pseudo-texture. Profile photos remain a later storage/model feature rather
  than a fake local upload.
- Reduced the directory to a single `Network` surface with no filter rails,
  counter, framing rules or pagination capsule. Member orbs have no frame, side
  navigation uses bare pointers with 48px hit targets, adjacent cards are direct
  selection controls, and only the complete active card links to the
  repository-backed member profile.
- Navigation display language is `Home`, `Contracts`, `Network` and `Performance`;
  existing route paths remain unchanged.
- Added deterministic project covers to the project record grammar and subtle
  inherited identity to opportunity rows. The palette is decorative and stable
  by project identifier.
- Recast Performance as one ordered record instead of a grid of cards. Performance still
  uses approved earnings only; teammate paid/projected privacy remains enforced
  by the repository contract.
- Removed black slab actions and permission panels in favor of bordered paper and
  bounded translucent controls. No shadow was introduced.
- Preserved `Amount`, tabular numerals, the projected-money class firewall,
  dynamic `notFound()` boundaries, and founder/operator presentation rules.
- Fixed the Admin outcome-focus race with `useLayoutEffect` so visible completion
  and focus restoration cannot be observed out of order.

## First exact-SHA acceptance repair

The first production/synthetic acceptance run against handoff SHA `9d345b3`
correctly rejected two presentation regressions. The repair at `1bc6b67`:

- restores the visible global focus ring on the keyboard-operable member
  coverflow; and
- presents evidence submission as an explicitly disabled control with an
  accessible unavailable explanation until a real write route exists, while
  keeping founder-only opportunity navigation separate.

That failed run remains immutable ignored evidence under
`.context/qa/ui-integrator/9d345b3.../20260826T071427Z-32310/`; it is not cited
as acceptance.

## Verification before this handoff

- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm test`: 32 files, 386 tests passed.
- `rm -rf .next && npm run build`: clean.
- `git diff --check`: clean.
- Advisory screenshots are under ignored
  `.context/studio-direction/`. Exact final-SHA production browser acceptance is
  intentionally performed after this tracked handoff is committed.

## Truthful limits

- Real PDF/DOCX/PPT extraction is **UNAVAILABLE**. The current intake action sends
  document metadata/filename and the synthetic adapter returns a labelled fixture;
  no binary-to-text parser or live extraction pipeline exists. The UI must not be
  described as processing real contracts until that backend slice lands.
- Member photo upload and project artwork upload are **UNAVAILABLE**. Current
  artwork is a deterministic fallback only; storage, private URLs, image review,
  and model fields require a separately reviewed product/backend change.
- XP, levels, streaks, token spend, commit-based productivity, chat, and realtime
  presence are **UNAVAILABLE**. No visual placeholder represents them as live.

## Next engineering slices

1. Document ingestion spike: private upload, MIME validation, PDF/DOCX text
   extraction, evidence spans, provider boundary, failure/retry, and an explicit
   founder review step. Never let AI approve finance.
2. Studio media slice: private member/project image storage, crop/replace/remove,
   deterministic fallback, RLS, signed delivery, and accessible alt/identity
   semantics.
3. Only after versioned event contracts exist: restrained player progression and
   compute/subscription evidence, with telemetry excluded from money and rank.
