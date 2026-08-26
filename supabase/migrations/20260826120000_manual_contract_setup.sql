-- FIRMA23 Ops — founder-usable V1: one atomic manual contract setup door.
--
-- docs/USABLE-V1-MASTER-PLAN.md's only V1 outcome: a signed-in founder
-- creates a contract manually, assigns existing active members, states what
-- each person does, enters a projected distributable amount, and persists
-- the complete setup in canonical tables in one transaction. This is
-- additive only — no existing table, column, or function is altered.
--
-- Deliberately separate from confirm_contract_draft (20260821090400), which
-- remains for legacy/manual project-shell intake (a bare project row with no
-- opportunity, service, rule, or assignment). create_manual_contract_setup
-- is the single door that creates a complete, immediately usable contract:
-- project, immutable service version, immutable allocation rule (org +
-- team shares totaling 10,000bp), an assigned opportunity, approved
-- founder-controlled assignment rows, and version 1 of that opportunity's
-- projection. It writes no cash event, settlement, payout, stat event, or
-- XP row — a projection is never earned or payable money.

-- ---------------------------------------------------------------------------
-- opportunity_projection_versions — a non-ledger, append-only record of what
-- a founder projected an opportunity's distributable base to be, at the
-- moment of manual setup. Never read by resolveDistributableBase, never
-- summed into approved/paid totals, never a source for Performance or XP.
-- A correction appends a later version; this migration's own RPC writes
-- version 1 only.
-- ---------------------------------------------------------------------------

create table public.opportunity_projection_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  opportunity_id uuid not null references public.opportunities(id),
  version integer not null check (version > 0),
  projected_base_centavos bigint not null check (projected_base_centavos > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_by_member_id uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  unique (opportunity_id, version)
);

alter table public.opportunity_projection_versions enable row level security;

create policy opportunity_projection_versions_select_founder on public.opportunity_projection_versions
  for select
  using (public.is_active_founder(org_id));

create policy opportunity_projection_versions_select_assigned on public.opportunity_projection_versions
  for select
  using (public.is_assigned_to_opportunity(opportunity_id));

-- No insert/update/delete policy for `authenticated` at all: only
-- create_manual_contract_setup (SECURITY DEFINER, below) writes this table,
-- and it never updates or deletes a row once inserted.
create trigger opportunity_projection_versions_immutable
  before update or delete on public.opportunity_projection_versions
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- manual_contract_setup_receipts — one row per successful
-- create_manual_contract_setup call, scoped by org_id (there is no
-- pre-existing opportunity to scope by, unlike payout_command_receipts —
-- this call creates the opportunity). request_fingerprint lets a replay
-- with the same key be distinguished from a mismatched key reuse
-- deterministically, exactly like payout_command_receipts.
-- ---------------------------------------------------------------------------

create table public.manual_contract_setup_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  idempotency_key text not null,
  request_fingerprint text not null,
  project_id uuid not null references public.projects(id),
  project_slug text not null,
  opportunity_id uuid not null references public.opportunities(id),
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

alter table public.manual_contract_setup_receipts enable row level security;

create policy manual_contract_setup_receipts_select_founder on public.manual_contract_setup_receipts
  for select
  using (public.is_active_founder(org_id));

-- No insert policy: only create_manual_contract_setup (SECURITY DEFINER)
-- writes this table.

-- ---------------------------------------------------------------------------
-- create_manual_contract_setup — the single atomic setup door.
--
-- SECURITY DEFINER with a fixed search_path; resolves the actor exclusively
-- from auth.uid() via current_member_id(), never from a client-supplied id;
-- requires an active founder membership in the org the caller claims to act
-- for; revokes execute from both PUBLIC and anon, grants only authenticated;
-- rejects a null/blank/oversized idempotency key; validates every string,
-- amount, currency, and weight before writing anything; appends exactly one
-- audit_events row and one manual_contract_setup_receipts row in the same
-- transaction as its real write (never on a pure idempotent replay, which
-- performs no write at all).
--
-- Serialization: there is no pre-existing row for this call to `for update`
-- lock (unlike approve_settlement/record_payout, which lock an opportunity
-- that already exists) — this call creates the opportunity. A session-scoped
-- advisory lock on (org_id, idempotency_key), released automatically at
-- commit or rollback, is what actually prevents two concurrent callers using
-- the identical key from both observing "no existing receipt" and both
-- creating a duplicate project/opportunity; the receipt table's own unique
-- constraint is defense in depth for the sequential-replay case, not the
-- concurrency guarantee itself.
-- ---------------------------------------------------------------------------

create or replace function public.create_manual_contract_setup(
  p_org_id uuid,
  p_client_name text,
  p_contract_name text,
  p_service_scope text,
  p_projected_base_centavos bigint,
  p_currency text,
  p_firma23_share_bp integer,
  p_assignments jsonb,
  p_idempotency_key text
)
returns table (project_id uuid, project_slug text, opportunity_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid;
  v_receipt public.manual_contract_setup_receipts;
  v_fingerprint text;
  v_assignment jsonb;
  v_idx integer;
  v_member_id uuid;
  v_role_label text;
  v_weight_bp integer;
  v_weight_sum integer := 0;
  v_member_ids uuid[] := array[]::uuid[];
  v_distinct_count integer;
  v_project_id uuid;
  v_slug text;
  v_service_version_id uuid;
  v_rule_version_id uuid;
  v_opportunity_id uuid;
  v_code text;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: create_manual_contract_setup';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception 'a valid idempotency key is required';
  end if;

  if p_client_name is null or btrim(p_client_name) = '' or length(p_client_name) > 300 then
    raise exception 'a valid client name is required';
  end if;
  if p_contract_name is null or btrim(p_contract_name) = '' or length(p_contract_name) > 300 then
    raise exception 'a valid contract name is required';
  end if;
  if p_service_scope is null or btrim(p_service_scope) = '' or length(p_service_scope) > 2000 then
    raise exception 'a valid service and scope description is required';
  end if;

  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid currency %', p_currency;
  end if;

  if p_projected_base_centavos is null or p_projected_base_centavos <= 0 then
    raise exception 'projected distributable base must be a positive amount';
  end if;

  if p_firma23_share_bp is null or p_firma23_share_bp < 0 or p_firma23_share_bp > 10000 then
    raise exception 'FIRMA23 share must fall within 0..10000 basis points';
  end if;

  -- Validate exact shape, type, and sign for every assignment before
  -- touching any table, mirroring record_payout's allocation validation.
  if jsonb_typeof(p_assignments) <> 'array' or jsonb_array_length(p_assignments) = 0 then
    raise exception 'create_manual_contract_setup requires a non-empty assignments array';
  end if;

  for v_idx in 0..jsonb_array_length(p_assignments) - 1 loop
    v_assignment := p_assignments -> v_idx;
    if jsonb_typeof(v_assignment) <> 'object' then
      raise exception 'assignment % must be a JSON object', v_idx;
    end if;
    if not (v_assignment ? 'memberId' and v_assignment ? 'roleLabel' and v_assignment ? 'weightBp')
      or (select count(*) from jsonb_object_keys(v_assignment)) <> 3
    then
      raise exception 'assignment % must have exactly memberId, roleLabel and weightBp', v_idx;
    end if;

    if jsonb_typeof(v_assignment -> 'memberId') <> 'string' then
      raise exception 'assignment % memberId must be a string', v_idx;
    end if;
    begin
      v_member_id := (v_assignment ->> 'memberId')::uuid;
    exception when invalid_text_representation then
      raise exception 'assignment % memberId is not a valid UUID', v_idx;
    end;

    if jsonb_typeof(v_assignment -> 'roleLabel') <> 'string' then
      raise exception 'assignment % roleLabel must be a string', v_idx;
    end if;
    v_role_label := v_assignment ->> 'roleLabel';
    if btrim(v_role_label) = '' or length(v_role_label) > 200 then
      raise exception 'assignment % roleLabel must be a non-empty label', v_idx;
    end if;

    if jsonb_typeof(v_assignment -> 'weightBp') <> 'number' then
      raise exception 'assignment % weightBp must be a number', v_idx;
    end if;
    v_weight_bp := (v_assignment ->> 'weightBp')::integer;
    if (v_assignment ->> 'weightBp')::numeric <> v_weight_bp then
      raise exception 'assignment % weightBp must be an integer', v_idx;
    end if;
    if v_weight_bp <= 0 or v_weight_bp > 10000 then
      raise exception 'assignment % weightBp must fall within 1..10000 basis points', v_idx;
    end if;

    if not exists (
      select 1
      from public.members m
      join public.memberships ms on ms.member_id = m.id
      where m.id = v_member_id
        and m.org_id = p_org_id
        and ms.org_id = p_org_id
        and ms.status = 'active'
    ) then
      raise exception 'assignment % references a member who is not an active member of org %', v_idx, p_org_id;
    end if;

    v_weight_sum := v_weight_sum + v_weight_bp;
    v_member_ids := v_member_ids || v_member_id;
  end loop;

  select count(distinct x) into v_distinct_count from unnest(v_member_ids) as x;
  if v_distinct_count <> array_length(v_member_ids, 1) then
    raise exception 'create_manual_contract_setup does not permit the same member twice';
  end if;

  if v_weight_sum <> 10000 then
    raise exception 'assignment weights total % basis points, expected exactly 10000', v_weight_sum;
  end if;

  -- Serializes concurrent calls sharing this exact (org, idempotency key)
  -- pair for the rest of this transaction. See the function header for why
  -- this is needed instead of a `for update` row lock.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':' || p_idempotency_key, 0));

  v_fingerprint := p_org_id::text || '|' || p_client_name || '|' || p_contract_name || '|'
    || p_service_scope || '|' || p_projected_base_centavos::text || '|' || p_currency || '|'
    || p_firma23_share_bp::text || '|' || p_assignments::text;

  select * into v_receipt from public.manual_contract_setup_receipts
  where org_id = p_org_id and idempotency_key = p_idempotency_key;

  if v_receipt.id is not null then
    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency key % was already used for a different contract setup request', p_idempotency_key;
    end if;
    return query select v_receipt.project_id, v_receipt.project_slug, v_receipt.opportunity_id, true;
    return;
  end if;

  v_slug := trim(regexp_replace(lower(p_contract_name), '[^a-z0-9]+', '-', 'g'), '-');
  if v_slug = '' then
    v_slug := 'contrato-' || substr(gen_random_uuid()::text, 1, 8);
  end if;
  while exists (select 1 from public.projects where slug = v_slug) loop
    v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  end loop;

  insert into public.projects (org_id, slug, name, sponsor_name, status, currency)
  values (p_org_id, v_slug, p_contract_name, p_client_name, 'active', p_currency)
  returning id into v_project_id;

  insert into public.service_versions (project_id, key, name, version, deliverables_summary)
  values (v_project_id, 'primary', p_service_scope, 1, p_service_scope)
  returning id into v_service_version_id;

  insert into public.allocation_rule_versions (project_id, version, effective_from, currency, base_policy)
  values (
    v_project_id, 1, current_date, p_currency,
    jsonb_build_object(
      'kind', 'cash_event_types',
      'includeTypes', jsonb_build_array('deposit'),
      'label', 'Depósitos confirmados',
      'note', 'Solo depósitos confirmados forman la base distribuible. Otros movimientos de caja se registran por separado y no participan hasta una actualización de la regla.'
    )
  )
  returning id into v_rule_version_id;

  insert into public.allocation_shares (rule_version_id, key, recipient_behavior, label, weight_bp, recipient_org_id)
  values
    (v_rule_version_id, 'firma23', 'org_recipient', 'FIRMA23', p_firma23_share_bp, p_org_id),
    (v_rule_version_id, 'team', 'member_pool', 'Equipo', 10000 - p_firma23_share_bp, null);

  update public.projects set active_allocation_rule_version_id = v_rule_version_id where id = v_project_id;

  v_code := upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 8));
  if v_code = '' then
    v_code := 'CONTRATO';
  end if;
  v_code := v_code || '-' || substr(gen_random_uuid()::text, 1, 4);
  while exists (select 1 from public.opportunities where code = v_code) loop
    v_code := v_code || substr(gen_random_uuid()::text, 1, 4);
  end loop;

  insert into public.opportunities (
    project_id, service_version_id, allocation_rule_version_id, code,
    beneficiary_name, beneficiary_location, status, opened_at
  )
  values (
    v_project_id, v_service_version_id, v_rule_version_id, v_code,
    p_client_name, '', 'assigned', current_date
  )
  returning id into v_opportunity_id;

  for v_idx in 0..jsonb_array_length(p_assignments) - 1 loop
    v_assignment := p_assignments -> v_idx;
    insert into public.assignments (opportunity_id, member_id, role_key, role_label, weight_bp, status)
    values (
      v_opportunity_id,
      (v_assignment ->> 'memberId')::uuid,
      'team',
      v_assignment ->> 'roleLabel',
      (v_assignment ->> 'weightBp')::integer,
      'approved'
    );
  end loop;

  insert into public.opportunity_projection_versions (
    org_id, opportunity_id, version, projected_base_centavos, currency, created_by_member_id
  )
  values (p_org_id, v_opportunity_id, 1, p_projected_base_centavos, p_currency, caller_id);

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id, caller_id, 'create_manual_contract_setup', 'projects', v_project_id,
    format('Founder created manual contract setup "%s" for %s', p_contract_name, p_client_name)
  );

  insert into public.manual_contract_setup_receipts (
    org_id, idempotency_key, request_fingerprint, project_id, project_slug, opportunity_id
  )
  values (p_org_id, p_idempotency_key, v_fingerprint, v_project_id, v_slug, v_opportunity_id)
  on conflict (org_id, idempotency_key) do nothing;
  -- No fallback read needed: the advisory lock above already serializes
  -- every caller sharing this exact (org_id, idempotency_key) for the whole
  -- transaction, so no concurrent twin of this exact call can be racing
  -- this insert.

  return query select v_project_id, v_slug, v_opportunity_id, false;
end;
$$;

revoke execute on function public.create_manual_contract_setup(uuid, text, text, text, bigint, text, integer, jsonb, text) from public;
revoke execute on function public.create_manual_contract_setup(uuid, text, text, text, bigint, text, integer, jsonb, text) from anon;
grant execute on function public.create_manual_contract_setup(uuid, text, text, text, bigint, text, integer, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Usable V1 repair: membership-safe assignments, canonical request digests,
-- and a member-scoped financial read model. This migration has not been
-- applied remotely; keeping the repair here preserves one atomic setup door.
-- ---------------------------------------------------------------------------

create or replace function public.guard_assignment_role_key()
returns trigger
language plpgsql
as $$
declare
  opportunity_org_id uuid;
  opportunity_rule_version_id uuid;
begin
  select p.org_id, o.allocation_rule_version_id
    into opportunity_org_id, opportunity_rule_version_id
  from public.opportunities o
  join public.projects p on p.id = o.project_id
  where o.id = new.opportunity_id;

  if opportunity_org_id is null then
    raise exception 'assignment references a nonexistent opportunity %', new.opportunity_id;
  end if;

  if not exists (
    select 1
    from public.members m
    join public.memberships ms on ms.member_id = m.id and ms.org_id = m.org_id
    where m.id = new.member_id
      and m.org_id = opportunity_org_id
      and ms.status = 'active'
  ) then
    raise exception 'assignment member % must be an active member of opportunity org %', new.member_id, opportunity_org_id;
  end if;

  if not exists (
    select 1 from public.allocation_shares
    where rule_version_id = opportunity_rule_version_id
      and key = new.role_key
      and recipient_behavior = 'member_pool'
  ) then
    raise exception
      'role_key % is not a member_pool share key on opportunity %''s allocation rule version',
      new.role_key, new.opportunity_id;
  end if;
  return new;
end;
$$;

create or replace function public.is_assigned_to_opportunity(p_opportunity_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    join public.members m on m.id = a.member_id
    join public.memberships ms on ms.member_id = m.id and ms.org_id = m.org_id
    where a.opportunity_id = p_opportunity_id
      and a.member_id = public.current_member_id()
      and a.status = 'approved'
      and ms.status = 'active'
      and m.org_id = public.org_id_for_opportunity(p_opportunity_id)
  );
$$;

drop policy opportunity_projection_versions_select_assigned on public.opportunity_projection_versions;

create or replace function public.manual_contract_setup_request_fingerprint(
  p_org_id uuid,
  p_client_name text,
  p_contract_name text,
  p_service_scope text,
  p_projected_base_centavos bigint,
  p_currency text,
  p_firma23_share_bp integer,
  p_assignments jsonb
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(
    digest(
      jsonb_build_object(
        'assignments', (
          select jsonb_agg(
            jsonb_build_object(
              'memberId', item->>'memberId',
              'roleLabel', btrim(item->>'roleLabel'),
              'weightBp', (item->>'weightBp')::integer
            ) order by item->>'memberId', btrim(item->>'roleLabel'), (item->>'weightBp')::integer
          )
          from jsonb_array_elements(p_assignments) item
        ),
        'clientName', btrim(p_client_name),
        'contractName', btrim(p_contract_name),
        'currency', p_currency,
        'firma23ShareBp', p_firma23_share_bp,
        'orgId', p_org_id,
        'projectedBaseCentavos', p_projected_base_centavos,
        'serviceScope', btrim(p_service_scope)
      )::text,
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.create_manual_contract_setup(
  p_org_id uuid,
  p_client_name text,
  p_contract_name text,
  p_service_scope text,
  p_projected_base_centavos bigint,
  p_currency text,
  p_firma23_share_bp integer,
  p_assignments jsonb,
  p_idempotency_key text
)
returns table (project_id uuid, project_slug text, opportunity_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid;
  v_receipt public.manual_contract_setup_receipts;
  v_fingerprint text;
  v_assignment jsonb;
  v_idx integer;
  v_member_id uuid;
  v_role_label text;
  v_weight_bp integer;
  v_weight_sum integer := 0;
  v_member_ids uuid[] := array[]::uuid[];
  v_distinct_count integer;
  v_project_id uuid;
  v_slug text;
  v_service_version_id uuid;
  v_rule_version_id uuid;
  v_opportunity_id uuid;
  v_code text;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: create_manual_contract_setup';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception 'a valid idempotency key is required';
  end if;
  if p_client_name is null or btrim(p_client_name) = '' or length(p_client_name) > 300 then raise exception 'a valid client name is required'; end if;
  if p_contract_name is null or btrim(p_contract_name) = '' or length(p_contract_name) > 300 then raise exception 'a valid contract name is required'; end if;
  if p_service_scope is null or btrim(p_service_scope) = '' or length(p_service_scope) > 2000 then raise exception 'a valid service and scope description is required'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'invalid currency %', p_currency; end if;
  if p_projected_base_centavos is null or p_projected_base_centavos <= 0 then raise exception 'projected distributable base must be a positive amount'; end if;
  if p_firma23_share_bp is null or p_firma23_share_bp < 0 or p_firma23_share_bp > 10000 then raise exception 'FIRMA23 share must fall within 0..10000 basis points'; end if;
  if jsonb_typeof(p_assignments) <> 'array' or jsonb_array_length(p_assignments) = 0 then raise exception 'create_manual_contract_setup requires a non-empty assignments array'; end if;
  for v_idx in 0..jsonb_array_length(p_assignments) - 1 loop
    v_assignment := p_assignments -> v_idx;
    if jsonb_typeof(v_assignment) <> 'object' or not (v_assignment ? 'memberId' and v_assignment ? 'roleLabel' and v_assignment ? 'weightBp') or (select count(*) from jsonb_object_keys(v_assignment)) <> 3 then raise exception 'assignment % must have exactly memberId, roleLabel and weightBp', v_idx; end if;
    if jsonb_typeof(v_assignment -> 'memberId') <> 'string' then raise exception 'assignment % memberId must be a string', v_idx; end if;
    begin v_member_id := (v_assignment ->> 'memberId')::uuid; exception when invalid_text_representation then raise exception 'assignment % memberId is not a valid UUID', v_idx; end;
    if jsonb_typeof(v_assignment -> 'roleLabel') <> 'string' then raise exception 'assignment % roleLabel must be a string', v_idx; end if;
    v_role_label := btrim(v_assignment ->> 'roleLabel');
    if v_role_label = '' or length(v_role_label) > 200 then raise exception 'assignment % roleLabel must be a non-empty label', v_idx; end if;
    if jsonb_typeof(v_assignment -> 'weightBp') <> 'number' then raise exception 'assignment % weightBp must be a number', v_idx; end if;
    v_weight_bp := (v_assignment ->> 'weightBp')::integer;
    if (v_assignment ->> 'weightBp')::numeric <> v_weight_bp or v_weight_bp <= 0 or v_weight_bp > 10000 then raise exception 'assignment % weightBp must fall within 1..10000 integer basis points', v_idx; end if;
    if not exists (select 1 from public.members m join public.memberships ms on ms.member_id = m.id and ms.org_id = m.org_id where m.id = v_member_id and m.org_id = p_org_id and ms.status = 'active') then raise exception 'assignment % references a member who is not an active member of org %', v_idx, p_org_id; end if;
    v_weight_sum := v_weight_sum + v_weight_bp; v_member_ids := v_member_ids || v_member_id;
  end loop;
  select count(distinct x) into v_distinct_count from unnest(v_member_ids) as x;
  if v_distinct_count <> array_length(v_member_ids, 1) then raise exception 'create_manual_contract_setup does not permit the same member twice'; end if;
  if v_weight_sum <> 10000 then raise exception 'assignment weights total % basis points, expected exactly 10000', v_weight_sum; end if;
  perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_org_id, p_idempotency_key)::text, 0));
  v_fingerprint := public.manual_contract_setup_request_fingerprint(p_org_id, p_client_name, p_contract_name, p_service_scope, p_projected_base_centavos, p_currency, p_firma23_share_bp, p_assignments);
  select * into v_receipt from public.manual_contract_setup_receipts where org_id = p_org_id and idempotency_key = p_idempotency_key;
  if v_receipt.id is not null then
    if v_receipt.request_fingerprint <> v_fingerprint then raise exception 'idempotency key % was already used for a different contract setup request', p_idempotency_key; end if;
    return query select v_receipt.project_id, v_receipt.project_slug, v_receipt.opportunity_id, true; return;
  end if;
  v_slug := trim(regexp_replace(lower(btrim(p_contract_name)), '[^a-z0-9]+', '-', 'g'), '-');
  if v_slug = '' then v_slug := 'contrato-' || substr(gen_random_uuid()::text, 1, 8); end if;
  while exists (select 1 from public.projects where slug = v_slug) loop v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4); end loop;
  insert into public.projects (org_id, slug, name, sponsor_name, status, currency) values (p_org_id, v_slug, btrim(p_contract_name), btrim(p_client_name), 'active', p_currency) returning id into v_project_id;
  insert into public.service_versions (project_id, key, name, version, deliverables_summary) values (v_project_id, 'primary', btrim(p_service_scope), 1, btrim(p_service_scope)) returning id into v_service_version_id;
  insert into public.allocation_rule_versions (project_id, version, effective_from, currency, base_policy) values (v_project_id, 1, current_date, p_currency, jsonb_build_object('kind','cash_event_types','includeTypes',jsonb_build_array('deposit'),'label','Depósitos confirmados','note','Solo depósitos confirmados forman la base distribuible.')) returning id into v_rule_version_id;
  insert into public.allocation_shares (rule_version_id, key, recipient_behavior, label, weight_bp, recipient_org_id) values (v_rule_version_id, 'firma23', 'org_recipient', 'FIRMA23', p_firma23_share_bp, p_org_id), (v_rule_version_id, 'team', 'member_pool', 'Equipo', 10000 - p_firma23_share_bp, null);
  update public.projects set active_allocation_rule_version_id = v_rule_version_id where id = v_project_id;
  v_code := upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 8)); if v_code = '' then v_code := 'CONTRATO'; end if; v_code := v_code || '-' || substr(gen_random_uuid()::text, 1, 4); while exists (select 1 from public.opportunities where code = v_code) loop v_code := v_code || substr(gen_random_uuid()::text, 1, 4); end loop;
  insert into public.opportunities (project_id, service_version_id, allocation_rule_version_id, code, beneficiary_name, beneficiary_location, status, opened_at) values (v_project_id, v_service_version_id, v_rule_version_id, v_code, btrim(p_client_name), '', 'assigned', current_date) returning id into v_opportunity_id;
  for v_idx in 0..jsonb_array_length(p_assignments) - 1 loop v_assignment := p_assignments -> v_idx; insert into public.assignments (opportunity_id, member_id, role_key, role_label, weight_bp, status) values (v_opportunity_id, (v_assignment ->> 'memberId')::uuid, 'team', btrim(v_assignment ->> 'roleLabel'), (v_assignment ->> 'weightBp')::integer, 'approved'); end loop;
  insert into public.opportunity_projection_versions (org_id, opportunity_id, version, projected_base_centavos, currency, created_by_member_id) values (p_org_id, v_opportunity_id, 1, p_projected_base_centavos, p_currency, caller_id);
  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary) values (p_org_id, caller_id, 'create_manual_contract_setup', 'projects', v_project_id, format('Founder created manual contract setup "%s" for %s', btrim(p_contract_name), btrim(p_client_name)));
  insert into public.manual_contract_setup_receipts (org_id, idempotency_key, request_fingerprint, project_id, project_slug, opportunity_id) values (p_org_id, p_idempotency_key, v_fingerprint, v_project_id, v_slug, v_opportunity_id);
  return query select v_project_id, v_slug, v_opportunity_id, false;
end;
$$;

create or replace function public.member_opportunity_financials()
returns table (
  opportunity_id uuid,
  currency text,
  projected_share_centavos bigint,
  approved_centavos bigint,
  paid_centavos bigint,
  owed_centavos bigint,
  recovery_centavos bigint,
  correction_required boolean
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with mine as (
    select a.opportunity_id, a.member_id, a.role_key, a.weight_bp
    from public.assignments a
    join public.members m on m.id = a.member_id
    join public.memberships ms on ms.member_id = m.id and ms.org_id = m.org_id
    where a.member_id = public.current_member_id() and a.status = 'approved' and ms.status = 'active'
  ), mine_opportunities as (
    select distinct opportunity_id, member_id from mine
  ), active_original as (
    select s.* from public.settlements s
    where s.status = 'approved' and s.kind = 'original'
      and not exists (select 1 from public.settlements r where r.corrects_settlement_id = s.id and r.status = 'approved' and r.kind = 'reversal')
  ), correction as (
    select distinct r.opportunity_id from public.settlements r
    where r.status = 'approved' and r.kind = 'reversal'
      and not exists (select 1 from active_original ao where ao.opportunity_id = r.opportunity_id)
  ), latest_projection as (
    select distinct on (pv.opportunity_id) pv.opportunity_id, pv.projected_base_centavos, pv.currency
    from public.opportunity_projection_versions pv order by pv.opportunity_id, pv.version desc
  ), projected as (
    select m.opportunity_id, lp.currency,
      coalesce(sum(floor((lp.projected_base_centavos * ash.weight_bp::bigint * m.weight_bp::bigint) / 100000000)::bigint), 0) as amount
    from mine m join public.opportunities o on o.id = m.opportunity_id
    join latest_projection lp on lp.opportunity_id = m.opportunity_id
    join public.allocation_shares ash on ash.rule_version_id = o.allocation_rule_version_id and ash.key = m.role_key and ash.recipient_behavior = 'member_pool'
    group by m.opportunity_id, lp.currency
  ), current_approved as (
    select m.opportunity_id, ao.currency, coalesce(sum(sl.amount_centavos),0) as amount
    from mine_opportunities m join active_original ao on ao.opportunity_id = m.opportunity_id
    join public.settlement_lines sl on sl.settlement_id = ao.id and sl.member_id = m.member_id
    group by m.opportunity_id, ao.currency
  ), historical_paid as (
    select m.opportunity_id, sl.currency, coalesce(sum(slp.amount_centavos),0) as amount
    from mine_opportunities m join public.settlement_lines sl on sl.member_id = m.member_id
    join public.settlements s on s.id = sl.settlement_id and s.opportunity_id = m.opportunity_id and s.kind = 'original'
    join public.settlement_line_payouts slp on slp.settlement_line_id = sl.id
    group by m.opportunity_id, sl.currency
  ), active_paid as (
    select m.opportunity_id, sl.currency, coalesce(sum(slp.amount_centavos),0) as amount
    from mine_opportunities m join active_original ao on ao.opportunity_id = m.opportunity_id
    join public.settlement_lines sl on sl.settlement_id = ao.id and sl.member_id = m.member_id
    left join public.settlement_line_payouts slp on slp.settlement_line_id = sl.id
    group by m.opportunity_id, sl.currency
  )
  select m.opportunity_id,
    coalesce(ca.currency, p.currency, hp.currency, 'MXN'),
    case when c.opportunity_id is null then coalesce(p.amount,0) else 0 end,
    case when c.opportunity_id is null then coalesce(ca.amount,0) else 0 end,
    coalesce(hp.amount,0),
    greatest(coalesce(ca.amount,0) - coalesce(ap.amount,0), 0),
    greatest(coalesce(hp.amount,0) - coalesce(ca.amount,0), 0),
    c.opportunity_id is not null
  from mine_opportunities m
  left join projected p on p.opportunity_id = m.opportunity_id
  left join current_approved ca on ca.opportunity_id = m.opportunity_id
  left join historical_paid hp on hp.opportunity_id = m.opportunity_id
  left join active_paid ap on ap.opportunity_id = m.opportunity_id
  left join correction c on c.opportunity_id = m.opportunity_id;
$$;

revoke execute on function public.manual_contract_setup_request_fingerprint(uuid, text, text, text, bigint, text, integer, jsonb) from public;
revoke execute on function public.member_opportunity_financials() from public;
grant execute on function public.member_opportunity_financials() to authenticated;
