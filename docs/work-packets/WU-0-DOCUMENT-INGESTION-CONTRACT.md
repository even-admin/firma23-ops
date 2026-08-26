# WU-0 document-ingestion contract

Status: `READY_FOR_FABLE`, not yet released to Terra.

- Control base: `9e7141b47a120874710d04efc998f3c42f41094b`
- Owner: SOL control
- Scope: real PDF/DOCX upload, verification, extraction and draft persistence
- Remote actions: none authorized or performed

## Outcome

FIRMA23 will ingest a document through a direct private-storage upload and a
separate authenticated processing boundary. The browser never sends document
bytes through a Vercel Function. AI output remains a draft and cannot call the
confirmation or finance boundaries.

```text
Browser                 Next.js / RLS client          Supabase             Provider
   |                              |                       |                    |
   |-- prepare metadata --------->|-- prepare RPC ------>| source: pending    |
   |<-- doc id + signed TUS token-|<---------------------|                    |
   |================ direct resumable bytes ===========>| private object      |
   |-- finalize doc id ---------->|-- download/auth ---->|                    |
   |                              |  verify/hash bytes    |                    |
   |                              |-- finalize RPC ------>| stored/duplicate   |
   |<-- stored source id ---------|<---------------------|                    |
   |-- process source id -------->|-- claim run RPC ---->| processing lease   |
   |                              |-- PDF/DOCX input ------------------------->|
   |                              |<---------------- strict draft + evidence --|
   |                              |-- complete RPC ------>| ready draft+audit  |
   |<-- founder review -----------|<---------------------|                    |
   |-- explicit confirm --------->|-- confirm RPC ------>| project + brief    |
```

Solid arrows are small authenticated commands. The double line is the only byte
upload and goes directly to Supabase Storage. Provider processing occurs only
after server-side byte verification.

## Scope challenge

Existing code already provides most authority boundaries:

- private `source-documents` bucket with founder-scoped INSERT/SELECT RLS;
- `source_documents`, `intake_runs`, `ai_contract_drafts` and immutable audit;
- founder-only `run_intake`, confirm and discard RPCs;
- active synthetic/Supabase repository selection;
- strict Zod/tool schema and a founder review UI;
- real authenticated server client with no service-role secret.

The existing code does not upload bytes. It registers a filename, reuses a seeded
draft and marks every result synthetic. The minimum complete change is therefore
to extend this path, not create a second intake subsystem.

WU-1 is split into schema and client halves because a single upload change would
otherwise cross migration, RPC, RLS, storage, browser, action, repository, UI and
test ownership in one commit.

## Official constraints

1. Vercel Functions have a 4.5 MB request/response payload limit. A 20 MB
   `FormData` Server Action would fail even if Next.js's configurable 1 MB Server
   Action limit were raised. Vercel recommends direct-to-storage client upload.
2. Supabase recommends TUS resumable upload for files over 6 MB, uses 6 MB chunks,
   supports signed upload tokens through the `x-signature` header and enforces
   Storage RLS.
3. Claude accepts PDF document blocks directly, including visual page context.
   The full request must stay under 32 MB; password-protected PDFs are unsupported.
   DOCX is not a supported binary document block and must be converted to text.
4. Mammoth supports server-side `extractRawText({buffer})`, but performs no
   sanitization and warns about pathological documents. FIRMA23 may use raw text
   only, keep external file access disabled, bound input/output and never render
   Mammoth HTML.
5. Standard Anthropic API retention must be treated as vendor processing. Only
   Development-approved client documents may be submitted. The application stores
   provider metadata and evidence, not the full extracted text or provider payload.

Sources:

- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Vercel direct-upload guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [Next.js Server Action body limit](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Claude PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
- [Claude citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Claude API retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- [Mammoth raw text and security](https://github.com/mwilliamson/mammoth.js#readme)
- [tus-js-client MIT license](https://github.com/tus/tus-js-client/blob/main/LICENSE)
- [Mammoth BSD 2-Clause license](https://github.com/mwilliamson/mammoth.js/blob/master/LICENSE)

Dependency decisions:

| Unit | Package | Boundary | Decision |
| --- | --- | --- | --- |
| WU-1B | `tus-js-client` | browser upload helper only | Allowed; MIT; required for Supabase's recommended resumable path above 6 MB. |
| WU-2 | `mammoth` | dynamically imported server module only | Allowed; BSD 2-Clause; raw text only, with strict input/output bounds. |

No PDF parser, Uppy, rendering framework, chart package or alternate storage SDK
is allowed by this packet.

## Frozen product rules

- Accepted formats are `.pdf` and `.docx` only. Existing `.doc`, `.ppt`, `.pptx`
  and `.txt` client acceptance is removed from the real path.
- `SourceDocumentKind` gains `contract_source`; the document-first drop zone uses
  that honest generic kind instead of pretending every upload is a proposal. The
  historical kinds remain valid for existing records.
- Maximum source size is 20 MiB. The bucket repeats this limit and allowlists only
  the two MIME types. Client checks improve UX; server byte checks are authority.
- Every object key is generated as
  `<org-id>/documents/<document-id>/source.<pdf|docx>`. Original filenames are
  metadata only and are never authorization or object identity.
- Upload uses `tus-js-client`, 6 MiB chunks, signed TUS token and no upsert. This is
  the only new WU-1 runtime dependency. No Uppy or second upload UI system.
- SHA-256 is computed from bytes downloaded through the authenticated server client
  after upload. A browser hash may be used for progress but is never authoritative.
- Configured mode never falls back to synthetic intake. Synthetic mode remains an
  explicitly labelled local demonstration and stores no bytes.
- Projects and contracts remain the same V1 row, as frozen by the initial identity
  migration. WU-4 does not introduce a second `contracts` or `clients` hierarchy.
- A proposed document amount is draft commercial information. It never becomes a
  cash event, distributable base, settlement, payout, approved earnings or XP.
- New live drafts have no projected allocation until a founder later selects a real
  versioned allocation rule and records authoritative cash.
- V1 treats an active founder as the organization authority. The app verifies bytes
  in a Server Action before calling finalization, while Postgres blocks members and
  cross-org callers. Without a privileged server credential, Postgres cannot prove
  that a founder did not call the RPC manually; records are therefore described as
  app-verified, not cryptographically attested against a malicious founder.

## Source-document state

The existing table is extended by one new additive migration. Existing seeded
rows remain `metadata_only`.

```text
metadata_only  (legacy/synthetic rows only)

pending --valid unique bytes--> stored
   |               |
   |               +-- same org + same SHA already stored --> duplicate
   |
   +-- invalid bytes / mismatch / failed verification --> failed
```

`stored` is terminal and immutable. `duplicate` points to the canonical stored
document. `failed` and `duplicate` objects are cleanup-eligible; a stored source is
not. A cleanup failure is visible and retryable, never silently reported as clean.

Required additive columns on `source_documents`:

- `file_format`: nullable `pdf | docx` for legacy compatibility;
- `declared_media_type`, `declared_byte_size`;
- `verified_media_type`, `verified_byte_size`, `sha256_hex`;
- `upload_status`: `metadata_only | pending | stored | duplicate | failed`;
- `upload_idempotency_key`, `duplicate_of_document_id`;
- `upload_expires_at`, `finalized_at`, `failure_code`;
- `object_cleanup_status`: `not_required | pending | complete | failed`;
- `cleanup_failure_code`, `cleaned_at`;
- `storage_path`, unique when present.

Required constraints:

- safe non-empty idempotency keys and unique `(org_id, upload_idempotency_key)`;
- exact lowercase 64-character SHA-256 when present;
- positive byte counts no larger than 20 MiB;
- file format, verified MIME and extension agree;
- duplicate target belongs to the same org and is `stored`;
- one canonical `stored` document per `(org_id, sha256_hex)`;
- transition trigger forbids mutation of stored byte identity.
- pending uploads have a bounded expiry; expiry never deletes an object without a
  matching source row and an explicit cleanup decision.

Abandoned upload handling:

- `prepare` sets a two-hour `upload_expires_at` matching the signed-upload window.
- Replaying a still-pending command may issue a fresh signed token for the same
  no-upsert path. The client attempts finalization first in case bytes already
  landed and only the response was lost.
- A founder may explicitly fail an expired pending row. Cleanup then follows the
  same recorded failed-object path; no scheduled deletion or cron is introduced.
- A pending row never appears as stored evidence or enters intake processing.

Required RPCs:

1. `prepare_source_document_upload`: active founder only; validates metadata,
   creates/replays the pending row and returns id/path. Reuse with different input
   fails deterministically.
2. `finalize_source_document_upload`: active founder only; records values verified
   by the server action, handles hash races and returns `stored | duplicate` plus
   canonical source id.
3. `fail_source_document_upload`: active founder only; moves only a pending row to
   failed with a closed error-code enum and safe message in the audit trail.
4. `record_source_document_cleanup`: active founder only; records the outcome of a
   Storage API deletion for a failed/duplicate row. It cannot alter stored rows.

All functions use `SECURITY DEFINER`, fixed `search_path`, `auth.uid()` identity,
explicit `PUBLIC`/`anon` revoke and `authenticated` grant. Direct UPDATE/DELETE on
`source_documents` remains unavailable. WU-1A also removes the existing direct
founder INSERT policy, making `prepare_source_document_upload` the only exposed
source-document write door. Storage DELETE is permitted only when the
matching source row is `failed` or `duplicate` and its exact path matches; the
application uses the Storage API, never direct SQL mutation of `storage.objects`.
The migration also updates the private bucket's size and MIME allowlists so client,
action, table and bucket boundaries agree.

## Upload actions

The file itself is not submitted in `FormData` to Next.js.

1. `prepareSourceDocumentUploadAction` receives only filename, declared MIME,
   declared byte size and idempotency key. It resolves the real viewer, runs the
   prepare RPC and creates a signed upload token for the generated path.
2. A small browser helper sends the `File` directly to the Supabase TUS endpoint
   with the token in `x-signature`. It reports byte progress, uses a stable upload
   fingerprint, removes that fingerprint after success and aborts on unmount.
3. `finalizeSourceDocumentUploadAction` receives only document id. It resolves the
   viewer, reads metadata under RLS, downloads the private object, enforces size,
   declared-size equality, extension/MIME and magic bytes, computes SHA-256, and
   invokes finalize/fail. It then removes only failed/duplicate objects and records
   the cleanup result. A retry attempts finalization before re-uploading, so a
   completed object left by a dropped response is recovered rather than overwritten.

The signed token is not logged or persisted and expires according to Supabase's
upload-token contract. An expired pending row can receive a fresh signed token for
the same generated path; `upsert` remains disabled. No provider call occurs in WU-1.

## Byte verification

- PDF must have a valid `%PDF-` header near the start and no encryption/password
  support is promised. Full structural/provider rejection is handled in WU-2/3.
- DOCX must begin as ZIP data. WU-2 additionally proves the archive contains valid
  Word document content before extraction.
- Declared and verified byte count must agree.
- Stored MIME is never accepted as proof; verified MIME is derived from format and
  byte inspection.
- Original filename is normalized for display and length only; it is never used in
  the object key.

## Processing run state

WU-2/3 replace the seeded `run_intake` behavior with a leased run state machine:

```text
new/error/stale --claim--> processing --complete--> ready
                                |
                                +--fail-----------> error
```

The claim RPC owns a random attempt token and lease expiry. Complete/fail must
present the current token, so a timed-out invocation cannot overwrite a later
retry. A replay of a ready run returns the same draft. An active lease returns
`processing`; a stale lease can be reclaimed. Provider calls never occur inside
Postgres.

The completion RPC transactionally inserts the draft, attaches it to the run,
records provider metadata and writes one audit event. It cannot confirm the draft.

## Extraction contract

PDF and DOCX intentionally take different input paths:

- PDF: download verified bytes, base64 encode in server memory and send as a native
  `application/pdf` document block. This preserves text, images, charts and page
  layout and avoids a PDF parser dependency.
- DOCX: use `mammoth.extractRawText({buffer})` server-only. Do not generate/render
  HTML; external file access stays disabled. Split bounded plaintext into stable
  paragraph blocks before the model call.

The provider defaults to `claude-sonnet-5`, not Opus, because this is bounded
extraction and Sonnet is the current speed/cost fit. The server-only environment may
override the model through an allowlisted model id. No browser receives the key,
raw source, provider request or signed URL.

The strict extraction result contains:

- client/sponsor name;
- project/program name;
- concise scope summary;
- deliverables as ordered claims;
- material dates as labelled claims, not an invented schedule;
- optional proposed contract value in integer centavos plus ISO currency;
- role-level assignment suggestions only, never people;
- missing/ambiguous review issues;
- confidence and at least one evidence item for every non-null claim.

DOCX evidence contains a paragraph index and quote that the application validates
against its extracted block. PDF evidence contains a provider page reference and
quote; because strict tool output does not produce API-native citation objects, the
UI labels it as a provider page reference and the founder remains the verifier.
Native citation verification is a later hardening option, not silently implied.

`example_distributable_base` becomes nullable for live drafts. It remains only for
the historical synthetic fixture backed by already-recorded cash. Live document
amounts use a separately named `proposed_contract_value` and never feed Revenue
Rail, Finance, Home or Performance.

Provider metadata stores provider, model, request id, input/output tokens,
processing timestamps and safe error code. It stores no credential, raw document,
full extracted plaintext or provider response body.

## Confirmation persistence

V1 keeps `projects` as the founder-facing contract record. Confirmation creates or
matches one project and appends an immutable `project_brief_versions` row containing
the reviewed scope, deliverables, dates, proposed commercial value and source
document id. This prevents confirmation from throwing away the document's useful
terms without creating a second contract hierarchy.

The project brief is not a finance table. Its proposed amount cannot be queried by
the finance/settlement repositories. WU-4's confirmation RPC writes project + brief
+ draft status + one audit event atomically and remains idempotent.

## Work-unit split

### WU-1A: schema and RPC foundation

Own only the new migration, source-document domain/schema/repository contracts, DB
harness and focused data tests. No package, component, browser upload or remote
apply. Gate: Fable ACCEPT on state transitions, concurrency, RLS and cleanup policy.

Frozen file ownership:

- new `supabase/migrations/20260826090000_source_document_uploads.sql`;
- `scripts/db-verify.sh`;
- `src/types/domain.ts`, `src/types/views.ts`, `src/data/schemas.ts`;
- `src/data/repositories/intake.ts`;
- `src/data/repositories/supabase/intake.ts` and
  `src/data/repositories/synthetic/intake.ts`;
- focused intake data tests and `docs/ui-handoffs/WU-1A.md`.

No other migration, seed, component, action, package, copy, finance, Auth or shared
chrome file is in WU-1A ownership. If compilation requires another file, stop and
return an ownership request rather than editing it.

### WU-1B: direct upload implementation

Add `tus-js-client`, browser Supabase helper, actions, adapter implementation,
Admin upload state and focused tests. No AI/parser. Gate: mocked local tests plus a
separately authorized Development Storage UAT before claiming remote success.

Frozen file ownership:

- `package.json` and `package-lock.json`, only for `tus-js-client`;
- new browser-only Supabase/upload helpers under `src/lib/supabase/` and
  `src/lib/intake/`;
- `src/app/(network)/admin/intake-actions.ts`;
- `src/components/admin/DocumentIntakePanel.tsx` and
  `src/components/admin/SourceDocumentCard.tsx`;
- `src/copy/es-MX.ts`, focused Admin intake tests and
  `docs/ui-handoffs/WU-1B.md`.

Repository contracts and WU-1A migration semantics are frozen during WU-1B. A
needed contract repair returns to SOL/Fable instead of being slipped into UI work.

### WU-2: DOCX boundary and run leasing

Add `mammoth`, raw-text extraction, bounds, valid DOCX checks, processing claim/fail
state and tests. PDF remains native provider input; no PDF parser dependency.

### WU-3: live evidence-backed extraction

Expand the dedicated tool schema, use native PDF/plain DOCX inputs, persist provider
metadata and complete drafts transactionally. A real provider credential/UAT is a
separate explicit Development action.

### WU-4: founder confirmation

Append reviewed project brief terms and audit atomically. Never write finance, XP,
assignment or settlement records.

## Test contract

Fixture matrix:

| Fixture | Storage | Purpose |
| --- | --- | --- |
| `test-proposal-text.pdf` | generated/committed test fixture | Two-page synthetic text, evidence-page mapping and proposed-value isolation. |
| `test-proposal-layout.pdf` | generated/committed test fixture | Synthetic table/layout content for native PDF provider UAT. |
| `test-brief-structured.docx` | generated/committed test fixture | Paragraph ordering, deliverables and dates. |
| `test-brief-ambiguous.docx` | generated/committed test fixture | Missing client and conflicting dates must create review issues. |

All four contain conspicuous `TEST-ONLY` identities and no real client, person,
credential or commercial information. Minimal bad-signature/oversize fixtures are
generated in tests rather than committed as large binaries. Real Luis-supplied
documents are uploaded only to authorized Development storage and never committed.

```text
Pure unit tests
  filename/format/MIME/magic/hash helpers
  client upload state/progress/error mapping
  DOCX paragraph bounds and extraction-schema validation

Disposable Postgres harness
  founder/member/cross-org RLS
  prepare replay and mismatched replay
  legal/illegal source state transitions
  concurrent same-hash canonicalization
  cleanup DELETE allowed only for failed/duplicate
  processing lease claim/reclaim/old-token rejection
  complete/fail/confirm replay and audit cardinality

Mocked application integration
  action -> repository -> Storage/provider success and every error branch
  no configured-mode synthetic fallback
  no token/path/raw text exposed to rendered output

Configured Development UAT (separately authorized)
  actual private TUS upload and authenticated download
  real PDF + DOCX processing
  member denial and cross-org denial
  failed/duplicate object cleanup
  provider unavailable and one real provider extraction
```

Every database failure assertion must match a specific error substring. Every
remote/browser receipt is bound to one exact SHA and environment.

## Performance and privacy budgets

- browser-to-storage upload: 20 MiB max, 6 MiB TUS chunks, progress visible;
- finalization: one authenticated object download, bounded in memory;
- DOCX extracted plaintext: maximum 250,000 UTF-8 bytes and 2,000 paragraph blocks;
- provider: one extraction call per successful attempt, no batch or Files API;
- no raw contract content in logs, audit summaries, analytics or browser state;
- no automatic retry after provider authorization, billing or malformed-output
  errors; the founder explicitly retries.

## Stop conditions

Stop the builder rather than fake success if:

- bytes still pass through Next/Vercel;
- configured mode returns the synthetic SETY draft for an uploaded file;
- the supported app path can mark bytes `stored` without Server Action verification;
- a stored document can be deleted through exposed RLS;
- model output can confirm a project or write finance/XP;
- provider evidence is absent for a non-null extracted field;
- a real document or credential would need to be committed or pasted into chat;
- remote migration, provider use, push or deploy lacks exact authorization.

## Fable questions

1. Under the explicit active-founder trust boundary, can a racing caller cause
   metadata to point at different bytes, overwrite a stored object or delete
   accepted evidence? Is stronger founder-hostile attestation required for V1?
2. Can duplicate/hash/finalize races produce two canonical stored documents?
3. Can an expired processing attempt overwrite a newer draft?
4. Does proposed contract value reach any ledger, projection, ranking or XP path?
5. Does PDF/DOCX handling honestly distinguish application-verified evidence from
   provider page references?
6. Is any simpler architecture equally complete under Vercel's 4.5 MB limit and
   Supabase's >6 MB resumable-upload guidance?
