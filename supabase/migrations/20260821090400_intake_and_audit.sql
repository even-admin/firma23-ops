-- FIRMA23 Ops — M2 foundation, part 5: document-first contract intake and the
-- audit trail.
--
-- This is the DB-level version of the authority boundary the M1 UI already
-- enforces in components: AI output (ai_contract_drafts) is draft-only by
-- construction. There is deliberately no INSERT/UPDATE policy on
-- ai_contract_drafts or audit_events for the `authenticated` role at all —
-- every write to either table goes through a security-definer function
-- (run_intake, confirm_contract_draft) that runs as the function owner and
-- re-checks founder authorization itself. A compromised or buggy client can
-- read a draft but cannot forge, confirm, or discard one, and cannot forge an
-- audit row, by direct table access.

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  uploaded_by_member_id uuid not null references public.members(id),
  filename text not null,
  kind text not null check (kind in ('proposal', 'executive_report', 'deck', 'quote', 'sow')),
  -- Object key inside the private `source-documents` storage bucket (next
  -- migration). Null until the binary itself is uploaded — a founder can
  -- register document metadata before or independently of a storage upload.
  storage_path text,
  uploaded_at timestamptz not null default now()
);

alter table public.source_documents enable row level security;

create policy source_documents_select_founder on public.source_documents
  for select
  using (public.is_active_founder(org_id));

create policy source_documents_founder_insert on public.source_documents
  for insert
  with check (
    public.is_active_founder(org_id)
    and uploaded_by_member_id = public.current_member_id()
  );

create table public.intake_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  requested_by_member_id uuid not null references public.members(id),
  status text not null check (status in ('processing', 'ready', 'error')),
  source_document_id uuid references public.source_documents(id),
  -- FK to ai_contract_drafts is added after that table exists, below.
  draft_id uuid,
  error_message text,
  -- Supplied by the client per submission attempt so a retried request with
  -- the same key cannot spawn a second run. This is the idempotency
  -- mechanism named in docs/WEEKEND-EXECUTION.md's backend checklist. Scoped
  -- to org_id (not globally unique) so one org's idempotency key can never
  -- collide with, or look up, another org's run.
  idempotency_key text not null,
  synthetic boolean not null default true,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (org_id, idempotency_key)
);

alter table public.intake_runs enable row level security;

create policy intake_runs_select_founder on public.intake_runs
  for select
  using (public.is_active_founder(org_id));

-- No insert/update policy for `authenticated`: intake_runs are only ever
-- written by the run_intake() function below.

-- Defense-in-depth database-level organization consistency: even though
-- run_intake() is the only writer and already verifies this itself, a
-- future bug in that function (or a different writer) should not be able to
-- record a run against a source document from another org.
create or replace function public.guard_intake_run_org_consistency()
returns trigger
language plpgsql
as $$
declare
  doc_org_id uuid;
begin
  if new.source_document_id is not null then
    select org_id into doc_org_id from public.source_documents where id = new.source_document_id;
    if doc_org_id is null or doc_org_id <> new.org_id then
      raise exception 'intake_run % source document does not belong to org %', new.id, new.org_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger intake_runs_guard_org_consistency
  before insert or update on public.intake_runs
  for each row execute function public.guard_intake_run_org_consistency();

create table public.ai_contract_drafts (
  id uuid primary key default gen_random_uuid(),
  intake_run_id uuid not null references public.intake_runs(id),
  source_document_id uuid not null references public.source_documents(id),
  org_id uuid not null references public.organizations(id),
  matched_project_id uuid references public.projects(id),
  matched_service_version_ids uuid[] not null default '{}',
  matched_allocation_rule_version_id uuid references public.allocation_rule_versions(id),
  extracted_at timestamptz not null default now(),
  sponsor_name jsonb not null,
  program_name jsonb not null,
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  example_distributable_base jsonb not null,
  example_distributable_base_note text not null default '',
  review_issues jsonb not null default '[]',
  suggested_assignments jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  confirmed_project_id uuid references public.projects(id),
  confirmed_at timestamptz,
  confirmed_by_member_id uuid references public.members(id),
  constraint ai_contract_drafts_confirmed_fields_together check (
    (status = 'confirmed' and confirmed_project_id is not null and confirmed_at is not null and confirmed_by_member_id is not null)
    or (status <> 'confirmed' and confirmed_at is null and confirmed_by_member_id is null)
  )
);

alter table public.intake_runs
  add constraint intake_runs_draft_fk
  foreign key (draft_id) references public.ai_contract_drafts(id);

alter table public.ai_contract_drafts enable row level security;

create policy ai_contract_drafts_select_founder on public.ai_contract_drafts
  for select
  using (public.is_active_founder(org_id));

-- No insert/update policy for `authenticated` on this table either. A draft
-- is born from run_intake() and can only change status through
-- confirm_contract_draft() or discard_contract_draft(), both below.

-- Defense-in-depth database-level organization consistency, mirroring the
-- guard on intake_runs above: a draft's source document, and its matched
-- project if any, must belong to the same org as the draft itself.
create or replace function public.guard_ai_contract_draft_org_consistency()
returns trigger
language plpgsql
as $$
declare
  doc_org_id uuid;
  project_org_id uuid;
begin
  select org_id into doc_org_id from public.source_documents where id = new.source_document_id;
  if doc_org_id is null or doc_org_id <> new.org_id then
    raise exception 'ai_contract_draft % source document does not belong to org %', new.id, new.org_id;
  end if;

  if new.matched_project_id is not null then
    select org_id into project_org_id from public.projects where id = new.matched_project_id;
    if project_org_id is null or project_org_id <> new.org_id then
      raise exception 'ai_contract_draft % matched project does not belong to org %', new.id, new.org_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger ai_contract_drafts_guard_org_consistency
  before insert or update on public.ai_contract_drafts
  for each row execute function public.guard_ai_contract_draft_org_consistency();

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  actor_member_id uuid references public.members(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  summary text not null,
  occurred_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

create policy audit_events_select_founder on public.audit_events
  for select
  using (public.is_active_founder(org_id));

create trigger audit_events_immutable
  before update or delete on public.audit_events
  for each row execute function public.forbid_mutation();

-- No insert policy at all: only security-definer functions write audit rows,
-- so the audit trail cannot be forged by a client that can merely call RPCs
-- for legitimate actions.

-- ---------------------------------------------------------------------------
-- run_intake — the deterministic local adapter's write path.
--
-- Deliberately does not call any external AI provider from SQL. It reads a
-- pre-seeded ai_contract_drafts row keyed by source_document_id — in M1/M2's
-- local-adapter mode that row is seeded once per known source document by
-- application code (see src/data/repositories/supabase/intake.ts) — and
-- returns a fresh intake_run + draft pair. A live-provider mode would
-- populate ai_contract_drafts from the application layer after a real model
-- call instead of relying on a pre-seeded row; either way, this function's
-- authorization and idempotency guarantees are identical.
-- ---------------------------------------------------------------------------

create or replace function public.run_intake(
  p_org_id uuid,
  p_source_document_id uuid,
  p_idempotency_key text
)
returns table (run_id uuid, draft_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  new_run_id uuid;
  seed_draft_id uuid;
  resolved_status text;
  resolved_error text;
  doc_org_id uuid;
  existing_source_document_id uuid;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: run_intake';
  end if;

  -- The source document itself must belong to the caller's org before
  -- anything else runs, so a guessed or leaked id from another org can
  -- never be used to read that org's draft content.
  select org_id into doc_org_id from public.source_documents where id = p_source_document_id;
  if doc_org_id is null or doc_org_id <> p_org_id then
    raise exception 'source document % does not belong to org %', p_source_document_id, p_org_id;
  end if;

  -- Local adapter: reuse the most recent draft already recorded for this
  -- source document rather than fabricate a new one, so repeated intake on
  -- the same document is deterministic. A live provider integration would
  -- insert a fresh ai_contract_drafts row here instead before proceeding.
  -- Scoped by org_id in addition to source_document_id — belt-and-suspenders
  -- against a draft ever resolving outside the caller's own org.
  select id into seed_draft_id
  from public.ai_contract_drafts
  where source_document_id = p_source_document_id
    and org_id = p_org_id
  order by extracted_at desc
  limit 1;

  if seed_draft_id is not null and exists (
    select 1 from public.ai_contract_drafts d
    where d.id = seed_draft_id
      and d.matched_project_id is not null
      and not exists (
        select 1 from public.projects p where p.id = d.matched_project_id and p.org_id = p_org_id
      )
  ) then
    raise exception 'draft % matches a project outside org %', seed_draft_id, p_org_id;
  end if;

  if seed_draft_id is null then
    resolved_status := 'error';
    resolved_error := 'No draft is available for this source document yet.';
  else
    resolved_status := 'ready';
    resolved_error := null;
  end if;

  -- Atomic upsert, not select-then-insert: two concurrent calls with the
  -- same (org_id, idempotency_key) cannot both observe "no existing run"
  -- and both insert. Exactly one insert wins; the loser falls through to
  -- read the winner's already-committed row, so a retried request is
  -- genuinely idempotent under concurrency, not merely under sequential
  -- retries.
  insert into public.intake_runs (
    org_id, requested_by_member_id, status, source_document_id, draft_id, idempotency_key, synthetic, completed_at, error_message
  ) values (
    p_org_id, caller_id, resolved_status, p_source_document_id, seed_draft_id, p_idempotency_key, true, now(), resolved_error
  )
  on conflict (org_id, idempotency_key) do nothing
  returning id into new_run_id;

  if new_run_id is null then
    -- Lost the insert race, or this is a genuine replay: either way, an
    -- existing row is out there. An idempotency key means "the same
    -- request, retried" — it does not mean "any request, retried" — so
    -- reusing it against a different source document is a deterministic
    -- conflict, not silently returned as if it were the earlier request.
    select id, source_document_id into new_run_id, existing_source_document_id
    from public.intake_runs
    where org_id = p_org_id and idempotency_key = p_idempotency_key;

    if existing_source_document_id <> p_source_document_id then
      raise exception
        'idempotency key % was already used for a different source document (existing %, requested %)',
        p_idempotency_key, existing_source_document_id, p_source_document_id;
    end if;
  else
    insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
    values (p_org_id, caller_id, 'run_intake', 'intake_runs', new_run_id, 'Founder ran document intake');
  end if;

  return query select ir.id, ir.draft_id, ir.status from public.intake_runs ir where ir.id = new_run_id;
end;
$$;

revoke execute on function public.run_intake(uuid, uuid, text) from public;
grant execute on function public.run_intake(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_contract_draft — the founder confirmation boundary, made durable.
--
-- Never trusts a client-supplied actor id: the caller is resolved from
-- auth.uid() via current_member_id(), exactly like every RLS policy above.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_contract_draft(
  p_draft_id uuid,
  p_org_id uuid,
  p_sponsor_name text,
  p_program_name text,
  p_currency text default 'MXN'
)
returns table (project_id uuid, project_slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  draft_row public.ai_contract_drafts;
  resolved_project_id uuid;
  resolved_slug text;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: confirm_contract_draft';
  end if;

  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency %', p_currency;
  end if;

  if p_draft_id is not null then
    select * into draft_row from public.ai_contract_drafts where id = p_draft_id;
    if draft_row is null then
      raise exception 'draft % does not exist', p_draft_id;
    end if;
    if draft_row.org_id <> p_org_id then
      raise exception 'draft % does not belong to org %', p_draft_id, p_org_id;
    end if;
    if draft_row.status <> 'draft' then
      raise exception 'draft % is already %; it cannot be confirmed again', p_draft_id, draft_row.status;
    end if;
  end if;

  if p_draft_id is not null and draft_row.matched_project_id is not null then
    -- The document matched an existing contract/project. Confirming does not
    -- create a duplicate; it only closes out the draft against what already
    -- exists.
    resolved_project_id := draft_row.matched_project_id;
    select slug into resolved_slug from public.projects where id = resolved_project_id;
  else
    resolved_slug := trim(
      regexp_replace(lower(p_program_name), '[^a-z0-9]+', '-', 'g'),
      '-'
    );
    if resolved_slug = '' then
      resolved_slug := 'contrato-' || substr(gen_random_uuid()::text, 1, 8);
    end if;
    -- Guarantee uniqueness even if two founders type the same program name.
    while exists (select 1 from public.projects where slug = resolved_slug) loop
      resolved_slug := resolved_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
    end loop;

    insert into public.projects (org_id, slug, name, sponsor_name, status, currency)
    values (p_org_id, resolved_slug, p_program_name, p_sponsor_name, 'draft', p_currency)
    returning id into resolved_project_id;
  end if;

  if p_draft_id is not null then
    update public.ai_contract_drafts
    set status = 'confirmed',
        confirmed_project_id = resolved_project_id,
        confirmed_at = now(),
        confirmed_by_member_id = caller_id
    where id = p_draft_id;
  end if;

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id, caller_id, 'confirm_contract_draft', 'projects', resolved_project_id,
    case
      when p_draft_id is null then 'Founder confirmed a manually entered contract'
      else 'Founder confirmed an AI-drafted contract'
    end
  );

  return query select resolved_project_id, resolved_slug;
end;
$$;

revoke execute on function public.confirm_contract_draft(uuid, uuid, text, text, text) from public;
grant execute on function public.confirm_contract_draft(uuid, uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- discard_contract_draft — the explicit rejection path, so a founder who
-- decides a draft is wrong has a real action instead of just abandoning it.
-- ---------------------------------------------------------------------------

create or replace function public.discard_contract_draft(p_draft_id uuid, p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  draft_status text;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: discard_contract_draft';
  end if;

  select status into draft_status from public.ai_contract_drafts where id = p_draft_id and org_id = p_org_id;
  if draft_status is null then
    raise exception 'draft % does not exist in org %', p_draft_id, p_org_id;
  end if;
  if draft_status <> 'draft' then
    raise exception 'draft % is already %; it cannot be discarded', p_draft_id, draft_status;
  end if;

  update public.ai_contract_drafts set status = 'discarded' where id = p_draft_id;

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (p_org_id, caller_id, 'discard_contract_draft', 'ai_contract_drafts', p_draft_id, 'Founder discarded an AI-drafted contract');
end;
$$;

revoke execute on function public.discard_contract_draft(uuid, uuid) from public;
grant execute on function public.discard_contract_draft(uuid, uuid) to authenticated;
