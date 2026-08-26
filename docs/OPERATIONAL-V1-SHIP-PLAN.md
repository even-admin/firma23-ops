# FIRMA23 operational V1 ship plan

Status: execution contract for an internal Development/Preview launch.
Target: usable by FIRMA23 tomorrow without synthetic-data misrepresentation.

## What "shipped" means

Operational V1 is shipped only when all of these are true on one exact SHA:

1. An invited founder and an invited member can authenticate in a configured
   Development/Preview environment and receive the correct RLS-backed role.
2. A founder can upload actual PDF and DOCX bytes into private Supabase Storage.
3. The system extracts a reviewable contract draft from the actual document,
   including client/program, scope, deliverables, dates and proposed amount, with
   confidence and source evidence. Proposed money is never ledger money.
4. A founder can edit, discard or confirm the draft. Confirmation creates the
   canonical project/contract work records and one audit event; replay is
   idempotent.
5. Members and projects can upload, replace and remove private profile/cover
   images under RLS. Deterministic mesh/project artwork remains the fallback.
6. Versioned XP is derived only from verified outcome events. It is append-only,
   reversible and non-editable; commits, tokens, spend and self-reported activity
   produce zero XP. Founders are excluded from competitive ranking.
7. Home, Contracts, Network, Performance, Projects, Admin and Finance read the
   canonical Supabase repositories in configured mode. No configured session may
   display synthetic records as operational data.
8. Founder/member, responsive, accessibility, money, RLS/RPC, dynamic-404 and
   console/network acceptance passes from a fresh exact-SHA build.

Production deployment is not part of this definition. The accepted Preview is
the internal launch candidate; Production requires a separate explicit approval.

## Deliberate V1 exclusions

- Community chat, realtime presence and kanban mutation.
- GitHub/Codex/Claude productivity competition and subscription connectors.
- PDF inline viewer, autonomous approvals and autonomous finance mutation.
- Marketplace self-application, public signup and public member profiles.
- OCR guarantees for corrupt/password-protected documents.

## Fixed product decisions

- AI drafts and cites; a founder confirms. AI never approves or posts ledger data.
- A document amount is stored as a proposed contract field until confirmation and
  remains distinct from deposits, distributable base, settlements and payouts.
- PDF uses a document-aware provider path so page context survives. DOCX is
  converted to sanitized text server-side with one narrowly reviewed parser.
- Files are private, org-scoped and addressed by generated object keys, never raw
  filenames. Duplicate bytes use a content hash and idempotency key.
- Profile/project media is org-readable and owner/founder-writable. File type,
  decoded dimensions and byte limits are enforced server-side.
- XP V1 rule: verified close 100; verified delivery 150; verified on-time outcome
  50. Reversals create exact negative XP under the same rule version. No money
  amount changes XP.

## Execution sequence

### WU-0 — Control reconstruction and schema freeze

Owner: Opus control. Sequential, before builders.

- Verify exact handoff HEAD, remote divergence, clean state and canonical project.
- Freeze additive migrations for source processing, media metadata, canonical
  read support and versioned XP.
- Freeze repository/view contracts and exact acceptance fixtures.
- Run adversarial architecture review before any remote apply.

Gate: zero unresolved blocker/high findings on schema, privacy, money or RLS.

### WU-1 — Real document ingestion

Owner: bounded backend builder.

- Replace filename-only input with a `FormData` Server Action handling real bytes.
- Validate extension, MIME, magic bytes and 20MB bound; compute SHA-256.
- Upload to `source-documents/<org>/<document-id>/<safe-name>`.
- Parse PDF/DOCX; call a dedicated strict extraction tool; require evidence.
- Persist source, run, draft, issues and provider metadata transactionally.
- Implement retry/idempotency, unsupported/encrypted/error states and cleanup of
  failed orphan uploads.
- Make `confirm_contract_draft` create canonical records; no ledger writes.

Gate: two supplied PDFs and two supplied DOCXs pass upload, extraction, review,
discard, confirm and replay tests without invented fields.

### WU-2 — Canonical repository read cutover

Owner: bounded data builder after WU-0 contracts.

- Complete Supabase member, opportunity, home, finance, settlement and leaderboard
  read adapters.
- Route every configured-mode read through `active/**` selectors.
- Empty canonical data renders honest empty states; it never falls back to demo.
- Retain synthetic mode only for explicit local development without Supabase.

Gate: configured founder/member sessions show only remote canonical rows; RLS
negative tests prove cross-member and founder-only boundaries.

### WU-3 — Profile and project media

Owner: bounded media builder after WU-0 migration.

- Add private buckets/metadata and RLS policies.
- Add upload, crop-preview, replace and remove actions with audit events.
- Render signed URLs with expiry/error fallback to IdentityOrb/ProjectCover.
- Never expose object paths as authorization and never accept remote image URLs.

Gate: owner/founder positive paths, member-negative paths, bad-file paths and
expired signed-URL fallback pass.

### WU-4 — Authoritative XP

Owner: bounded game-system builder after WU-0 migration.

- Add immutable `xp_rule_versions` and `xp_events` with unique source-event keys.
- Materialize signed XP from authoritative `stat_events`; corrections reverse.
- Add personal level/progress and non-founder Performance ordering.
- Keep approved-money ranking provenance available separately; never blend the
  two scores.

Gate: duplicate, reversal, founder-exclusion and anti-inflation DB scenarios pass.

### WU-5 — Advanced UI review and repair

Owner: Sonnet/Fable visual critic, then a bounded UI builder.

- Review exact Home/Network visual output against approved direction.
- Repair only evidence-backed hierarchy, responsive and interaction defects.
- Do not change data contracts, financial semantics or introduce dependencies.
- Preserve focus-reveal Network behavior unless Luis explicitly requests a flip.

Gate: independent review records ACCEPT with exact screenshots and no false-green
responsive cells.

### WU-6 — Integration and launch acceptance

Owner: Opus control only.

- Integrate builders in dependency order: WU-1, WU-2, WU-3, WU-4, WU-5.
- Run lint, typecheck, unit tests, DB harness and production build.
- Run exact 375/767/768/1280 browser matrix in synthetic and configured modes.
- Run real invited founder/member Auth, real document UAT and media UAT.
- Obtain adversarial code/security/design reviews and repair until ACCEPT.
- Push/Preview only with explicit authorization. Production remains blocked.

## Evidence ledger

Each work unit must record: base SHA, final SHA, changed files, migration names,
tests, browser URLs/viewports, role/mode, unavailable evidence, remote actions and
rollback. A green unit result never substitutes for final integrated evidence.

## Luis action gates

These are inputs, not engineering ambiguity:

1. Supply two representative PDFs and two DOCXs approved for Development use.
2. Configure the AI provider credential directly in Development/Preview through a
   secrets-safe control; never paste it into chat or commit it.
3. Supply one non-founder invitation email for real member/RLS browser QA.
4. Authorize each reviewed remote migration application, Preview push and final
   Production action separately when its exact SHA and rollback are known.

## Stop conditions

Stop rather than fake success if document bytes are not stored, provider output
lacks evidence, configured reads fall back to synthetic data, RLS cannot be proven,
money state is ambiguous, a remote credential control disagrees after reload, or
browser evidence is not bound to the exact candidate SHA.
