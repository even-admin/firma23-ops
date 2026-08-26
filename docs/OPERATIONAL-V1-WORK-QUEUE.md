# FIRMA23 operational V1 work queue

Status: single-workspace execution queue. This converts the ship plan into
bounded model handoffs. Base at creation: `c55d8076490ca9fe4bbec61f8162ab106406f368`.

## Working rule

One unit is active at a time in the Abuja control workspace. The baton is:

1. SOL defines or tightens the packet, then parks.
2. Terra/5.5 builds one packet and commits one logical checkpoint.
3. Fable audits that exact committed SHA read-only.
4. Sonnet makes only accepted, bounded repairs and commits them.
5. SOL rules on remaining material findings and releases the next packet.

No participant starts an implementation while another participant has a dirty
worktree. Fable returns its report in chat unless the writer is parked. Remote
migration applies, provider configuration, push, Preview and Production are
separate authorization gates.

## Queue

| Order | Work unit | Primary outcome | Builder | Gate before next unit |
| --- | --- | --- | --- | --- |
| 0 | Contract freeze | Accepted upload/extraction/persistence contracts and test fixtures | SOL + Fable | No unresolved schema, RLS, privacy or money HIGH/BLOCKER |
| 1 | Upload truth | Real PDF/DOCX bytes reach private storage with immutable metadata | Terra/5.5 | Bytes, hash, key, limits, idempotency and failure cleanup proven locally |
| 2 | Document text boundary | Sanitized, bounded PDF/DOCX text with page/section evidence | Terra/5.5 | Corrupt, encrypted, oversized and unsupported documents fail honestly |
| 3 | Evidence-backed draft | Provider/local extraction writes a reviewable draft, never authority | Terra/5.5 | Missing/ambiguous fields and provider-unavailable state proven |
| 4 | Founder draft authority | Edit/discard/confirm creates canonical work and one audit trail | Terra/5.5 | Replay/idempotency and no-ledger-write invariants proven |
| 5 | Canonical operational reads | Configured Home, Contracts, Network, Projects and Performance never fall back to synthetic data | Terra/5.5 | Founder/member/RLS positive and negative reads proven |
| 6 | Finance read cutover | Configured Finance/settlement reads preserve approved, paid, projected and reversed semantics | Terra/5.5 | Money regression and cross-org denial evidence pass |
| 7 | Private identity media | Member/project image upload, replacement and removal with deterministic visual fallback | Terra/5.5 | Owner/founder/member-negative and expired URL states proven |
| 8 | Authoritative XP | Reversible XP from verified outcome events only, plus founder exclusion | Terra/5.5 | DB anti-inflation, duplicate and reversal scenarios pass |
| 9 | Configured launch acceptance | Fresh exact-SHA configured browser/RLS/document/media acceptance | Sonnet + SOL | Fable ACCEPT; all unavailable evidence is explicitly escalated |

Units 1–4 are the document-first vertical slice. They are intentionally
sequential because they share `source_documents`, intake contracts, server
actions and the Admin surface. Units 5–8 may be reconsidered for a separate
workspace only after a pushed exact base and explicit file ownership; they do
not run concurrently by default.

## WU-0: SOL contract freeze

**Goal:** turn existing M1/M2 intake scaffolding into an accepted implementation
contract before any builder adds a parser or migration.

**Inspect:** `AGENTS.md`, all `docs/`, `src/types/{domain,views}.ts`,
`src/data/repositories/{intake.ts,supabase/intake.ts}`, `src/lib/ai/provider.ts`,
Admin intake components/actions, migrations `20260821090400` and
`20260821090500`, and DB harness coverage.

**Decide, without implementation:**

- additive source-document metadata required for byte hash, MIME, byte count,
  object key, processing state and extraction provenance;
- whether one reviewed PDF parser and one DOCX parser are unavoidable, their
  server-only boundary, bundle/CSP risk and license;
- action/RPC sequence so upload, metadata registration, processing and cleanup
  cannot falsely report success;
- exact no-provider and provider-error behavior;
- four sanitized Development fixtures: two PDF and two DOCX, never committed if
  they contain client-sensitive data.

**Stop:** produce a small tracked work packet and Fable review. Do not add a
dependency, migration or remote configuration in WU-0.

## WU-1: upload truth

**Goal:** replace the filename-only intake with a real server-side upload path.

**Likely ownership:** `src/app/(network)/admin/intake-actions.ts`,
`src/components/admin/DocumentIntakePanel.tsx`, intake repository contracts and
adapter, source-document types/schemas, a new additive migration, DB harness
and focused tests. Exact ownership is frozen by WU-0.

**Required behavior:**

- accept only PDF/DOCX; validate filename, declared MIME and magic bytes;
- enforce a 20 MB bound before storage; compute SHA-256 from actual bytes;
- use generated org-scoped object keys, never client filenames as authority;
- make duplicate/retry semantics explicit; register metadata only after storage
  succeeds, and remove an orphan only when it is known to be newly created;
- represent upload/processing/error states honestly in the Admin UI;
- do not call AI, write a ledger record or claim extraction succeeded.

**Acceptance:** unit and DB tests prove bad type, spoofed MIME, bad signature,
size limit, duplicate bytes, retry, founder/member denial and storage failure.
The builder commits locally, then parks.

## WU-2: document text boundary

**Goal:** obtain bounded, sanitized text and locations from the stored bytes.

**Required behavior:**

- PDF evidence retains page labels; DOCX evidence retains a stable section or
  paragraph label;
- plaintext has hard byte/character limits before it reaches an AI client;
- encrypted, corrupted, scanned-without-text and malformed files are explicit
  review/error states, not empty successful extractions;
- no raw document text, provider key or signed URL is sent to the browser;
- parser work is server-only and does not weaken SSR/build behavior.

**Dependency gate:** no parser dependency lands until WU-0 records why the
existing runtime cannot do the job and Fable accepts the parser boundary.

**Acceptance:** two sanitized PDFs and two DOCXs plus malformed/encrypted cases
produce evidence locations or honest failure states. The user supplies any
real client documents only through Development storage, never this repository.

## WU-3: evidence-backed draft

**Goal:** persist an extraction result as a non-authoritative, founder-reviewable
draft.

**Required behavior:**

- use a dedicated strict tool contract; extracted values require quoted evidence;
- return `missing` or `ambiguous` rather than inventing an answer;
- proposed contract amounts remain proposed fields and never enter money totals;
- provider unavailable, malformed output and provider error are distinguishable;
- no UI may call confirmation automatically.

**External gate:** a provider credential may be configured only through the
approved secrets-safe Development control. Its absence must still leave a
useful, honest manual/review path.

## WU-4: founder draft authority

**Goal:** complete the review boundary without creating financial authority.

**Required behavior:** founder can edit permitted proposed fields, discard, or
confirm exactly once. Confirmation creates canonical project/contract work and
one audit event, remains idempotent, and posts no cash event, settlement,
allocation, ranking result or XP.

**Acceptance:** confirm replay, discard replay, cross-org draft attempt,
member denial, provider failure and stale draft behavior are tested at the RPC
and UI layers.

## WU-5 to WU-8: operational records, media and XP

Each unit gets its own SOL packet before construction. They must preserve the
existing money firewall and will not introduce fictional historical charts,
token/spend metrics, commit rankings, public media or implicit XP. WU-7 media
is private and fallback-first; WU-8 XP is an append-only materialization from
verified outcomes, with exact reversals and no founder competition.

## WU-9: launch acceptance

The final candidate is verified from a fresh exact-SHA server in both synthetic
and configured modes. Required evidence includes 375/767/768/1280 viewports,
focus/reduced-motion/overflow checks, founder and invited member RLS behavior,
dynamic 404s, document and media UAT, all finance semantics and zero browser
console/network errors. A Preview push or remote apply remains separately
authorized.

## First Terra prompt

Use this only after WU-0 has an ACCEPT verdict:

```text
You are FIRMA23 WU-1 builder in the single active workspace.

Read AGENTS.md, all docs/, docs/OPERATIONAL-V1-SHIP-PLAN.md,
docs/OPERATIONAL-V1-WORK-QUEUE.md and the accepted WU-0 packet. Confirm the
exact branch, HEAD, merge-base and clean worktree before editing.

Implement WU-1 only: real private PDF/DOCX byte upload and truthful Admin
upload state. Do not implement text parsing, AI extraction, canonical confirm,
media, XP, finance changes or remote actions. Preserve every money invariant.
Use FormData Server Actions and the existing Supabase/server repository
patterns. Do not add a runtime dependency unless the accepted WU-0 packet
explicitly allows it. Do not apply migrations remotely, push, deploy, create
credentials or use external services.

Own only the files frozen in WU-0. Add focused tests and DB-harness scenarios.
Run relevant tests, then lint, typecheck, full test suite, build and the DB
harness where applicable. Commit one logical checkpoint locally and write a
tracked handoff with exact SHA, changed files, evidence, unavailable work and
the exact Fable audit questions. Park after the commit.
```

## Fable audit prompt

```text
Audit FIRMA23 WU-[N] read-only at the exact committed SHA supplied by the
builder. Do not edit product files, install packages, start remote actions or
write while a builder has a dirty worktree. Read AGENTS.md, all docs/, the work
packet, the builder handoff and every changed file. Lead with BLOCKER/HIGH
findings tied to executable acceptance conditions. Verify authority, RLS,
idempotency, document privacy, money/XP firewall, error states and test claims.
Return ACCEPT only when no unresolved BLOCKER/HIGH remains. Do not propose scope
expansion as a required repair.
```

## Sonnet repair prompt

```text
Repair only accepted Fable findings for FIRMA23 WU-[N] at the exact builder SHA.
Confirm no other writer is active and the worktree is clean. Read AGENTS.md,
all docs/, the work packet, builder handoff and Fable report first. Do not
broaden scope, change financial rules, add dependencies, apply migrations
remotely, push, deploy or configure providers. Add the smallest tests that
prove each repair, run the required checks, commit one repair checkpoint and
park. Report unresolved findings honestly for SOL adjudication.
```
