-- FIRMA23 Ops — founder crew management: replace an opportunity's team
-- pool assignments atomically before any settlement exists.
--
-- Additive only. This migration creates one new receipt table and one new
-- SECURITY DEFINER RPC (replace_opportunity_crew), and removes exactly one
-- pre-existing RLS policy (assignments_founder_write) so that RPC — plus the
-- already-reviewed create_manual_contract_setup — become the only doors that
-- can write public.assignments. No historical migration, finance write RPC,
-- or Auth/redeem-invite function is touched.
--
-- Scope: this RPC replaces the single member_pool ("team") role on an
-- opportunity's current allocation rule version. An opportunity whose rule
-- defines more than one member_pool (for example a closer/delivery split)
-- is refused outright rather than guessed at — replace_opportunity_crew
-- does not invent which pool the founder meant to edit.
--
-- Money honesty: this RPC never touches opportunity_projection_versions.
-- The founder's projected distributable base stays exactly what it was
-- projected at; member_opportunity_financials() already derives each
-- member's projected share live from the *current* assignment weights, so
-- a crew replacement immediately and correctly changes what each affected
-- member sees as their projected share — without ever rewriting or
-- fabricating a new immutable projection row. approve_settlement likewise
-- always reads assignments at approval time, so the settlement a founder
-- approves after a crew change is derived from the crew that was actually
-- in place, never a stale snapshot.

-- ---------------------------------------------------------------------------
-- opportunity_crew_receipts — one row per successful replace_opportunity_crew
-- call, scoped by (org_id, opportunity_id, idempotency_key), matching the
-- single opportunity this function locks per call — mirrors
-- payout_command_receipts' scoping rationale exactly.
-- ---------------------------------------------------------------------------

create table public.opportunity_crew_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  opportunity_id uuid not null references public.opportunities(id),
  idempotency_key text not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (org_id, opportunity_id, idempotency_key)
);

alter table public.opportunity_crew_receipts enable row level security;

create policy opportunity_crew_receipts_select_founder on public.opportunity_crew_receipts
  for select
  using (public.is_active_founder(org_id));

-- No insert policy: only replace_opportunity_crew (SECURITY DEFINER) writes
-- this table.

-- ---------------------------------------------------------------------------
-- Remove the browser-direct assignments write path. assignments_select_founder
-- and assignments_select_self (20260821090200) are untouched, so founders and
-- assignees keep read access. create_manual_contract_setup and
-- replace_opportunity_crew are both SECURITY DEFINER and therefore bypass RLS
-- on the tables they write internally (see that migration's file header for
-- why a definer function owned by the table owner bypasses RLS) — dropping
-- this policy closes the only remaining direct-write door without touching
-- either RPC's ability to write.
-- ---------------------------------------------------------------------------

drop policy assignments_founder_write on public.assignments;

-- ---------------------------------------------------------------------------
-- replace_opportunity_crew_request_fingerprint — canonical JSON digest of the
-- assignment set, sorted so member order never affects the fingerprint.
-- Mirrors manual_contract_setup_request_fingerprint's rationale exactly
-- (JSON avoids the delimiter-collision shape a plain concatenated key would
-- allow). Non-callable directly by PUBLIC, anon, or authenticated — reachable
-- only from inside the SECURITY DEFINER RPC below.
-- ---------------------------------------------------------------------------

create or replace function public.replace_opportunity_crew_request_fingerprint(
  p_org_id uuid,
  p_opportunity_id uuid,
  p_assignments jsonb
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(
    extensions.digest(
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
        'opportunityId', p_opportunity_id,
        'orgId', p_org_id
      )::text,
      'sha256'
    ),
    'hex'
  );
$$;

revoke execute on function public.replace_opportunity_crew_request_fingerprint(uuid, uuid, jsonb) from public;
revoke execute on function public.replace_opportunity_crew_request_fingerprint(uuid, uuid, jsonb) from anon;
revoke execute on function public.replace_opportunity_crew_request_fingerprint(uuid, uuid, jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- replace_opportunity_crew — the single atomic crew-replacement door.
--
-- SECURITY DEFINER with a fixed search_path; resolves the actor exclusively
-- from auth.uid() via current_member_id(), never from a client-supplied id;
-- requires an active founder membership in the org the caller claims to act
-- for; revokes execute from both PUBLIC and anon, grants only authenticated;
-- rejects a null/blank/oversized idempotency key; validates every assignment
-- (member id, role label, weight) before writing anything; locks the target
-- opportunity before any replay/read/write decision, exactly like
-- record_cash_event/approve_settlement/reverse_settlement/record_payout;
-- refuses the command outright if the opportunity has ever had a settlement
-- (settlement_lines and settlement_line_payouts cannot exist without a
-- parent settlements row, so this single check also covers reversals and
-- payouts); writes exactly one audit_events row and one
-- opportunity_crew_receipts row on a genuine change, never on a pure
-- idempotent replay.
-- ---------------------------------------------------------------------------

create or replace function public.replace_opportunity_crew(
  p_org_id uuid,
  p_opportunity_id uuid,
  p_assignments jsonb,
  p_idempotency_key text
)
returns table (opportunity_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid;
  v_receipt public.opportunity_crew_receipts;
  v_fingerprint text;
  v_assignment jsonb;
  v_idx integer;
  v_member_id uuid;
  v_role_label text;
  v_weight_bp integer;
  v_weight_sum integer := 0;
  v_member_ids uuid[] := array[]::uuid[];
  v_distinct_count integer;
  v_rule_version_id uuid;
  v_pool_count integer;
  v_role_key text;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: replace_opportunity_crew';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception 'a valid idempotency key is required';
  end if;

  if public.org_id_for_opportunity(p_opportunity_id) is distinct from p_org_id then
    raise exception 'opportunity % does not belong to org %', p_opportunity_id, p_org_id;
  end if;

  -- Validate exact shape, type, and sign for every assignment before
  -- touching any table, mirroring create_manual_contract_setup.
  if jsonb_typeof(p_assignments) <> 'array' or jsonb_array_length(p_assignments) = 0 then
    raise exception 'replace_opportunity_crew requires a non-empty assignments array';
  end if;

  for v_idx in 0..jsonb_array_length(p_assignments) - 1 loop
    v_assignment := p_assignments -> v_idx;
    if jsonb_typeof(v_assignment) <> 'object'
      or not (v_assignment ? 'memberId' and v_assignment ? 'roleLabel' and v_assignment ? 'weightBp')
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
    v_role_label := btrim(v_assignment ->> 'roleLabel');
    if v_role_label = '' or length(v_role_label) > 200 then
      raise exception 'assignment % roleLabel must be a non-empty label', v_idx;
    end if;

    if jsonb_typeof(v_assignment -> 'weightBp') <> 'number' then
      raise exception 'assignment % weightBp must be a number', v_idx;
    end if;
    v_weight_bp := (v_assignment ->> 'weightBp')::integer;
    if (v_assignment ->> 'weightBp')::numeric <> v_weight_bp or v_weight_bp <= 0 or v_weight_bp > 10000 then
      raise exception 'assignment % weightBp must fall within 1..10000 integer basis points', v_idx;
    end if;

    if not exists (
      select 1
      from public.members m
      join public.memberships ms on ms.member_id = m.id and ms.org_id = m.org_id
      where m.id = v_member_id
        and m.org_id = p_org_id
        and ms.status = 'active'
    ) then
      raise exception 'assignment % references a member who is not an active member of org %', v_idx, p_org_id;
    end if;

    v_weight_sum := v_weight_sum + v_weight_bp;
    v_member_ids := v_member_ids || v_member_id;
  end loop;

  select count(distinct x) into v_distinct_count from unnest(v_member_ids) as x;
  if v_distinct_count <> array_length(v_member_ids, 1) then
    raise exception 'replace_opportunity_crew does not permit the same member twice';
  end if;

  if v_weight_sum <> 10000 then
    raise exception 'assignment weights total % basis points, expected exactly 10000', v_weight_sum;
  end if;

  -- Lock the opportunity before any replay/read/write decision, exactly
  -- like every finance write RPC — this is what makes the settlement-block
  -- check and the receipt lookup below consistent reads no concurrent call
  -- on this same opportunity can change out from under it.
  perform 1 from public.opportunities where id = p_opportunity_id for update;

  v_fingerprint := public.replace_opportunity_crew_request_fingerprint(p_org_id, p_opportunity_id, p_assignments);

  -- Table-qualified: this function's own `returns table (opportunity_id ...)`
  -- declares opportunity_id as an out parameter in scope here, which would
  -- otherwise make an unqualified `opportunity_id = ...` ambiguous between
  -- that parameter and this table's own column of the same name (same pitfall
  -- reverse_settlement's settlement_id out parameter has, see its comment).
  select * into v_receipt from public.opportunity_crew_receipts r
  where r.org_id = p_org_id and r.opportunity_id = p_opportunity_id and r.idempotency_key = p_idempotency_key;
  if v_receipt.id is not null then
    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency key % was already used for a different crew replacement request', p_idempotency_key;
    end if;
    return query select p_opportunity_id, true;
    return;
  end if;

  -- settlement_lines and settlement_line_payouts cannot exist without a
  -- parent settlements row (both carry a NOT NULL FK to it), so this single
  -- existence check also covers reversals and payouts, regardless of the
  -- settlement's own status ('pending' or 'approved').
  if exists (select 1 from public.settlements s where s.opportunity_id = p_opportunity_id) then
    raise exception
      'opportunity % already has settlement authority; its crew can no longer be replaced', p_opportunity_id;
  end if;

  select o.allocation_rule_version_id into v_rule_version_id
  from public.opportunities o where o.id = p_opportunity_id;

  select count(*) into v_pool_count
  from public.allocation_shares
  where rule_version_id = v_rule_version_id and recipient_behavior = 'member_pool';
  if v_pool_count <> 1 then
    raise exception
      'replace_opportunity_crew requires exactly one team pool on this opportunity''s allocation rule, found %',
      v_pool_count;
  end if;

  select key into v_role_key
  from public.allocation_shares
  where rule_version_id = v_rule_version_id and recipient_behavior = 'member_pool';

  delete from public.assignments a where a.opportunity_id = p_opportunity_id and a.role_key = v_role_key;

  for v_idx in 0..jsonb_array_length(p_assignments) - 1 loop
    v_assignment := p_assignments -> v_idx;
    insert into public.assignments (opportunity_id, member_id, role_key, role_label, weight_bp, status)
    values (
      p_opportunity_id,
      (v_assignment ->> 'memberId')::uuid,
      v_role_key,
      btrim(v_assignment ->> 'roleLabel'),
      (v_assignment ->> 'weightBp')::integer,
      'approved'
    );
  end loop;

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id, caller_id, 'replace_opportunity_crew', 'opportunities', p_opportunity_id,
    format('Founder replaced the crew on opportunity %s with %s member(s)', p_opportunity_id, jsonb_array_length(p_assignments))
  );

  -- No ON CONFLICT clause: the opportunity lock taken above already
  -- serializes every caller sharing this exact (org_id, opportunity_id,
  -- idempotency_key) tuple for the whole transaction, so this insert cannot
  -- race a concurrent twin of itself — matching create_manual_contract_setup's
  -- own final (hardened) form. An ON CONFLICT column list here is also
  -- rejected by Postgres as ambiguous against this function's own
  -- `opportunity_id` OUT parameter, the same pitfall as the SELECT above.
  insert into public.opportunity_crew_receipts (org_id, opportunity_id, idempotency_key, request_fingerprint)
  values (p_org_id, p_opportunity_id, p_idempotency_key, v_fingerprint);

  return query select p_opportunity_id, false;
end;
$$;

revoke execute on function public.replace_opportunity_crew(uuid, uuid, jsonb, text) from public;
revoke execute on function public.replace_opportunity_crew(uuid, uuid, jsonb, text) from anon;
grant execute on function public.replace_opportunity_crew(uuid, uuid, jsonb, text) to authenticated;
