# FIRMA23 founder-usable V1 master plan

Status: `READY_FOR_SONNET_BUILD`

- Planning base: `3199c646054fdef2c24362c8449b41e96245d477`
- Product target: one founder can create and operate one real contract tomorrow
- Delivery method: one Sonnet build, one Fable audit, one bounded Sonnet repair,
  one SOL release decision
- Production, push, Preview and remote migration apply remain separate approvals

## The only V1 outcome

A signed-in founder can create a contract manually, assign existing active
members, state what each person does, enter a projected distributable amount and
persist the complete setup in canonical Supabase tables. The created contract is
immediately visible on Projects and Contracts. Its detail shows:

- client, contract, service and scope;
- assigned members and role labels;
- projected FIRMA23 participation and projected member amounts;
- approved and paid values when authoritative settlement data exists;
- an explicit distinction between projected, approved and paid money.

The configured application never substitutes synthetic records. A route without a
completed canonical adapter renders an honest unavailable/empty state.

This is a founder-operated internal V1. Member self-service, document upload,
provider extraction, XP, image upload, connectors and public launch are deferred.

## Reuse, do not rebuild

- Existing invite-only Auth and founder RLS.
- Existing `projects`, immutable service/rule versions, opportunities, assignments,
  finance ledger, settlements, payouts and audit tables.
- Existing `confirm_contract_draft` remains for legacy/manual project-shell intake;
  the new complete setup uses one separate atomic RPC.
- Existing allocation math, `Amount`, Revenue Rail and polished route UI.
- Existing Supabase project adapter and finance write RPCs.

## One additive write model

Add `opportunity_projection_versions`, a non-ledger append-only table:

- `id`, `org_id`, `opportunity_id`, `version`;
- `projected_base_centavos` as a positive integer and ISO `currency`;
- `created_by_member_id`, `created_at`;
- unique `(opportunity_id, version)`;
- immutable after insert;
- founder can read; assigned members can read only their opportunity;
- no direct browser write policy.

Projection rows never enter cash events, settlements, approved earnings, paid
earnings, Performance or XP. A correction appends a later version; V1 setup writes
version 1 only.

Add founder-only `create_manual_contract_setup(...)` as the single atomic setup
door. It receives:

- client name, contract name, service name and scope;
- projected distributable base and currency;
- FIRMA23 share in basis points;
- one or more unique active same-org member assignments with role labels and
  within-team weights summing to 10,000 basis points;
- a non-empty idempotency key.

In one transaction it creates:

1. active project/contract;
2. immutable primary service version;
3. immutable allocation rule with `org` and `team` shares totaling 10,000 bp;
4. assigned opportunity;
5. approved founder-controlled assignment rows;
6. projection version 1;
7. one safe audit event and one idempotency receipt.

It writes no cash event, settlement, payout, stat event or XP. It derives actor and
organization from the authenticated membership, validates all members, currencies,
weights and strings in Postgres, and returns project slug/opportunity id. Replay
returns the original result; mismatched key reuse fails deterministically.

The default finance base policy is an explicit generic snapshot: confirmed
`deposit` events only. It is persisted on the rule version and shown in review; no
component owns or infers a project-specific financial rule.

## Minimal setup UI

Replace the current two-field manual fallback with one focused founder form:

- Cliente
- Contrato
- Servicio y alcance
- Bolsa proyectada para distribución (MXN)
- Participación FIRMA23 (%)
- Team rows: member, role, team weight

Require at least one member and exact 100% team weights. Convert display currency
to integer centavos before the repository boundary. Keep a persistent review
summary beside/after the form. Submit once, show pending/error/retry, and navigate
to the created contract on success.

All projected values use `Amount` with neutral classes. Projected subtrees contain
zero `money` classes. Copy must say projected, never earned, approved or payable.

## Canonical read cutover

Add active selectors and Supabase adapters needed by these routes:

- Projects list/detail;
- Contracts list/detail;
- Network member source used by the assignment picker;
- the founder contract summary on Home;
- Admin contract count/summary;
- founder Finance summary for projected, approved and paid values.

Do not redesign routes. In configured mode every touched route reads Supabase. If a
nonessential route lacks a canonical adapter, replace synthetic output with an
honest unavailable/empty state rather than expanding the build.

Founder reads all assignments and finance. A member query may see only their own
assignment, projected share and settlement lines. Performance remains approved
earnings only; projections never affect rank.

## Frozen exclusions

- PDF/DOCX upload, AI extraction and `project_brief_versions`.
- Profile/project media.
- XP and game progression.
- Subscription/token/GitHub connectors.
- Chat, kanban, realtime, autonomous actions or new visual references.
- Production deploy or new external resources.

The deferred document architecture remains in
`docs/work-packets/WU-0-DOCUMENT-INGESTION-CONTRACT.md` for later; it is not a
prerequisite for this V1.

## Build ownership

Sonnet may edit only:

- one new additive migration and `scripts/db-verify.sh`;
- domain/view/schema and repository contracts required by this slice;
- new/active Supabase adapters for the listed routes;
- Admin manual-contract actions/components and required copy;
- listed route pages only to replace synthetic imports with active selectors;
- focused tests and `docs/ui-handoffs/USABLE-V1.md`;
- `package.json` only if existing tooling cannot implement the slice; default is
  no dependency change.

Do not edit Auth, historical migrations, finance write RPCs, tokens, global chrome,
MeshDrift, IdentityOrb, package versions, Vercel or Supabase configuration.

## Acceptance gate

1. Disposable Postgres applies every migration and seed from zero.
2. RPC tests cover founder success, member denial, cross-org member denial,
   malformed weights, amount/currency validation, replay and mismatched replay.
3. A created setup has exactly one project, service, rule, opportunity, projection,
   audit event and the expected assignments.
4. The setup transaction produces zero rows in cash, settlement, payout, stat and
   XP tables.
5. Configured repository tests prove no synthetic fallback.
6. Founder sees all assignments; member visibility is self-only.
7. Projected versus approved/paid money tests and projected `money`-class firewall
   pass.
8. Lint, typecheck, full tests, build and DB harness pass.
9. Browser QA at 375, 768 and 1280 proves create -> redirect -> persisted readback,
   no overflow, focus/error behavior and zero console errors.
10. Real Development apply, Auth test and one real contract creation require fresh
    authorization after code and Fable acceptance.

## Stop rules

Stop instead of expanding if the build needs document bytes, an AI key, a new
identity, a service-role key, a financial assumption not entered by the founder,
or any remote action. Report the exact blocker; do not add a fake success path.

## Sonnet builder prompt

```text
Build FIRMA23 founder-usable V1 at the exact clean HEAD supplied by SOL in
/Users/racosta/conductor/workspaces/firma23-ops/abuja.

Read AGENTS.md, all docs, and docs/USABLE-V1-MASTER-PLAN.md first. Confirm exact
branch, HEAD and clean status. Follow that master plan as the entire scope.

Implement one atomic founder-only manual contract setup with assignments and a
non-ledger append-only projected distributable base, then cut the listed configured
routes to canonical Supabase reads. Reuse existing schemas, allocation math,
Amount, Revenue Rail, Auth and UI. Do not implement PDF/DOCX, AI, XP, images,
connectors, chat, redesign, Production or any remote action. Do not modify old
migrations or finance write RPCs. Add no dependency unless genuinely unavoidable.

Preserve all money/RLS invariants. Configured mode must never show synthetic data.
Add focused unit/repository tests and executable DB-harness scenarios. Run lint,
typecheck, full tests, build and scripts/db-verify.sh. Commit one local checkpoint,
write docs/ui-handoffs/USABLE-V1.md with exact evidence, and park. Do not push.
```

## Fable audit prompt

```text
Audit FIRMA23 founder-usable V1 read-only at the exact Sonnet SHA. Read AGENTS.md,
all docs, docs/USABLE-V1-MASTER-PLAN.md, the handoff and every changed file. Do not
edit, install, push, deploy or touch remote services.

Lead with BLOCKER/HIGH findings and executable acceptance tests. Challenge atomic
setup/idempotency, RLS, assignment weights, projection isolation, approved/paid
truth, configured synthetic fallback, member privacy, error states and claimed
verification. ACCEPT only with no unresolved BLOCKER/HIGH. Confirm exact SHA and
clean worktree.
```
