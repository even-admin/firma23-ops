-- FIRMA23 Ops — P3: the audited canonical finance write boundary.
--
-- P1 removed every direct client INSERT policy from cash_events, settlements,
-- settlement_lines, and settlement_line_payouts, leaving those tables with no
-- write path at all (architecture-decision.md §4.4). This migration adds the
-- only four doors:
--
--   record_cash_event()   — post a ledger fact (never a payout).
--   approve_settlement()  — derive and approve a settlement from durable
--                            records; the client submits no money figure.
--   reverse_settlement()  — the exact signed reversal of an approved original.
--   record_payout()       — atomically create a payout event and its
--                            allocations, or reallocate against a historical
--                            payout event for reverse-and-reissue.
--
-- Every RPC here: is SECURITY DEFINER with a fixed search_path; resolves the
-- actor exclusively from auth.uid() via current_member_id(), never from a
-- client-supplied id; requires an active founder membership in the org the
-- caller claims to act for (is_active_founder already rejects wrong-org,
-- revoked, and unauthenticated callers by construction); is idempotent under
-- concurrency via an atomic `insert ... on conflict do nothing returning`,
-- never select-then-insert; and appends exactly one audit_events row in the
-- same transaction as its real write (never on a pure idempotent replay,
-- which performs no write at all).
--
-- Additive only. No table created in migrations 20260821090000-090500 is
-- altered in a way that changes any existing row's meaning — only new,
-- nullable idempotency_key columns are added to cash_events and settlements,
-- mirroring the (org_id, idempotency_key) pattern intake_runs already uses.

alter table public.cash_events add column idempotency_key text;
alter table public.cash_events add constraint cash_events_opportunity_idempotency unique (opportunity_id, idempotency_key);

alter table public.settlements add column idempotency_key text;
alter table public.settlements add constraint settlements_opportunity_idempotency unique (opportunity_id, idempotency_key);

-- ---------------------------------------------------------------------------
-- split_by_weights_centavos — largest-remainder split, exactly mirroring
-- src/lib/money.ts's splitByWeights (same tie-break: remainder desc, then
-- original index asc) so a founder-approved settlement's amounts never
-- disagree with what the same rule would have projected in the UI.
--
-- Pure arithmetic on its own inputs, touches no table, and is SECURITY
-- INVOKER by default — there is nothing here to protect, so it keeps the
-- default PUBLIC execute grant rather than needing a revoke/grant pair.
-- ---------------------------------------------------------------------------

create or replace function public.split_by_weights_centavos(p_total bigint, p_weights_bp integer[])
returns bigint[]
language plpgsql
as $$
declare
  n integer := array_length(p_weights_bp, 1);
  scaled bigint[] := array_fill(0::bigint, array[coalesce(array_length(p_weights_bp, 1), 0)]);
  parts bigint[] := array_fill(0::bigint, array[coalesce(array_length(p_weights_bp, 1), 0)]);
  remainders bigint[] := array_fill(0::bigint, array[coalesce(array_length(p_weights_bp, 1), 0)]);
  distributed bigint := 0;
  leftover bigint;
  weight_sum integer := 0;
  idx integer;
  order_idx integer[];
begin
  if n is null or n = 0 then
    raise exception 'split_by_weights_centavos requires at least one weight';
  end if;
  if p_total < 0 then
    raise exception 'split_by_weights_centavos requires a non-negative total';
  end if;

  for idx in 1..n loop
    weight_sum := weight_sum + p_weights_bp[idx];
  end loop;
  if weight_sum <> 10000 then
    raise exception 'weights must total 10000 basis points, received %', weight_sum;
  end if;

  for idx in 1..n loop
    scaled[idx] := p_total * p_weights_bp[idx];
    parts[idx] := scaled[idx] / 10000;
    remainders[idx] := scaled[idx] % 10000;
    distributed := distributed + parts[idx];
  end loop;

  leftover := p_total - distributed;

  -- Aliased `gs`, not `idx`: the plpgsql variable `idx` declared above would
  -- otherwise collide with a same-named generate_series column, and Postgres
  -- rejects the query as ambiguous rather than guessing which one is meant.
  select array_agg(gs order by remainders[gs] desc, gs asc)
  into order_idx
  from generate_series(1, n) as gs;

  foreach idx in array order_idx loop
    exit when leftover <= 0;
    parts[idx] := parts[idx] + 1;
    leftover := leftover - 1;
  end loop;

  return parts;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_cash_event — the only door for invoice/withholding/deposit/
-- contribution/adjustment facts. Never payout: that is record_payout()'s
-- door alone, so a payout can never exist without its allocations in the
-- same atomic write.
-- ---------------------------------------------------------------------------

create or replace function public.record_cash_event(
  p_org_id uuid,
  p_opportunity_id uuid,
  p_type text,
  p_label text,
  p_amount_centavos bigint,
  p_currency text,
  p_occurred_at date,
  p_idempotency_key text
)
returns table (cash_event_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  existing public.cash_events;
  new_id uuid;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: record_cash_event';
  end if;

  if public.org_id_for_opportunity(p_opportunity_id) <> p_org_id then
    raise exception 'opportunity % does not belong to org %', p_opportunity_id, p_org_id;
  end if;

  if p_type = 'payout' then
    raise exception 'record_cash_event cannot create a payout event; use record_payout';
  end if;

  insert into public.cash_events (
    opportunity_id, type, label, amount_centavos, currency, occurred_at, idempotency_key
  ) values (
    p_opportunity_id, p_type, p_label, p_amount_centavos, p_currency, p_occurred_at, p_idempotency_key
  )
  on conflict (opportunity_id, idempotency_key) do nothing
  returning id into new_id;

  if new_id is null then
    select * into existing from public.cash_events
    where opportunity_id = p_opportunity_id and idempotency_key = p_idempotency_key;
    if existing.type <> p_type
      or existing.label <> p_label
      or existing.amount_centavos <> p_amount_centavos
      or existing.currency <> p_currency
      or existing.occurred_at <> p_occurred_at
    then
      raise exception
        'idempotency key % was already used for a different cash event request', p_idempotency_key;
    end if;
    return query select existing.id, true;
    return;
  end if;

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id, caller_id, 'record_cash_event', 'cash_events', new_id,
    format('Founder recorded a %s cash event of %s %s', p_type, p_amount_centavos, p_currency)
  );

  return query select new_id, false;
end;
$$;

revoke execute on function public.record_cash_event(uuid, uuid, text, text, bigint, text, date, text) from public;
grant execute on function public.record_cash_event(uuid, uuid, text, text, bigint, text, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- approve_settlement — the client submits only an opportunity id. Every
-- money figure is derived here from the opportunity's own snapshotted rule
-- version, its base_policy-selected cash events, its allocation_shares, and
-- its approved assignments — never from a client-submitted base or line
-- amount. Fails outright if any required member_pool is not exactly
-- 10,000bp or any org_recipient has no resolvable organization.
-- ---------------------------------------------------------------------------

create or replace function public.approve_settlement(
  p_org_id uuid,
  p_opportunity_id uuid,
  p_idempotency_key text
)
returns table (settlement_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  existing public.settlements;
  v_rule public.allocation_rule_versions;
  v_base bigint;
  v_share record;
  v_share_weights integer[];
  v_share_amounts bigint[];
  v_share_idx integer;
  v_sequence integer := 0;
  v_pool_total integer;
  v_participant_weights integer[];
  v_participant_amounts bigint[];
  v_participant_idx integer;
  v_participant record;
  new_settlement_id uuid;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: approve_settlement';
  end if;

  if public.org_id_for_opportunity(p_opportunity_id) <> p_org_id then
    raise exception 'opportunity % does not belong to org %', p_opportunity_id, p_org_id;
  end if;

  select * into existing from public.settlements
  where opportunity_id = p_opportunity_id and idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.kind <> 'original' then
      raise exception
        'idempotency key % was already used for a different settlement request on this opportunity',
        p_idempotency_key;
    end if;
    return query select existing.id, true;
    return;
  end if;

  -- Excludes a settlement carrying our own idempotency key: under read
  -- committed, this check and the one above run as separate snapshots, so a
  -- concurrent identical call's commit can land in the gap between them. If
  -- that happens, the row it committed is OUR OWN request's twin, not a
  -- genuinely different conflicting settlement — without this exclusion, up
  -- to 19 of 20 concurrent identical callers could see this raise instead of
  -- resolving to the idempotent replay at the insert's ON CONFLICT below.
  if exists (
    select 1 from public.settlements s
    where s.opportunity_id = p_opportunity_id and s.kind = 'original' and s.status = 'approved'
      and s.idempotency_key is distinct from p_idempotency_key
      and not exists (
        select 1 from public.settlements r
        where r.corrects_settlement_id = s.id and r.kind = 'reversal' and r.status = 'approved'
      )
  ) then
    raise exception
      'opportunity % already has an active approved settlement; reverse it before reissuing',
      p_opportunity_id;
  end if;

  select arv.* into v_rule
  from public.opportunities o
  join public.allocation_rule_versions arv on arv.id = o.allocation_rule_version_id
  where o.id = p_opportunity_id;

  if v_rule.id is null then
    raise exception 'opportunity % has no resolvable allocation rule version', p_opportunity_id;
  end if;

  if exists (
    select 1 from public.cash_events
    where opportunity_id = p_opportunity_id
      and type in (select jsonb_array_elements_text(v_rule.base_policy -> 'includeTypes'))
      and currency <> v_rule.currency
  ) then
    raise exception
      'opportunity % has a base-contributing cash event in a currency other than %',
      p_opportunity_id, v_rule.currency;
  end if;

  select coalesce(sum(amount_centavos), 0) into v_base
  from public.cash_events
  where opportunity_id = p_opportunity_id
    and type in (select jsonb_array_elements_text(v_rule.base_policy -> 'includeTypes'));

  if v_base < 0 then
    raise exception 'opportunity % has a negative distributable base %', p_opportunity_id, v_base;
  end if;

  -- Validate every share before writing anything: a partially staffed pool
  -- or a dangling org recipient blocks the whole approval, never a partial
  -- distribution.
  for v_share in
    select * from public.allocation_shares where rule_version_id = v_rule.id order by key
  loop
    if v_share.recipient_behavior = 'member_pool' then
      select coalesce(sum(weight_bp), 0) into v_pool_total
      from public.assignments
      where opportunity_id = p_opportunity_id and role_key = v_share.key and status = 'approved';
      if v_pool_total <> 10000 then
        raise exception
          'member pool % totals % basis points, expected exactly 10000', v_share.key, v_pool_total;
      end if;
    elsif v_share.recipient_behavior = 'org_recipient' then
      if v_share.recipient_org_id is null
        or not exists (select 1 from public.organizations where id = v_share.recipient_org_id)
      then
        raise exception 'org_recipient share % has no resolvable recipient organization', v_share.key;
      end if;
    end if;
  end loop;

  -- Atomic upsert, not a plain insert: two concurrent callers can both pass
  -- the early idempotency check above (neither's insert has committed yet),
  -- so the actual insert must itself be conflict-safe. A plain insert here
  -- would let 19 of 20 concurrent identical calls fail with a raw unique-
  -- constraint error instead of resolving to the one winner.
  insert into public.settlements (
    opportunity_id, allocation_rule_version_id, status, kind, base_centavos, currency,
    approved_at, approved_by_member_id, idempotency_key
  ) values (
    p_opportunity_id, v_rule.id, 'approved', 'original', v_base, v_rule.currency,
    now(), caller_id, p_idempotency_key
  )
  on conflict (opportunity_id, idempotency_key) do nothing
  returning id into new_settlement_id;

  if new_settlement_id is null then
    -- Lost the race: a concurrent identical call already committed. Return
    -- its result rather than building a second, now-redundant set of lines.
    select * into existing from public.settlements
    where opportunity_id = p_opportunity_id and idempotency_key = p_idempotency_key;
    if existing.kind <> 'original' then
      raise exception
        'idempotency key % was already used for a different settlement request on this opportunity',
        p_idempotency_key;
    end if;
    return query select existing.id, true;
    return;
  end if;

  select array_agg(weight_bp order by key) into v_share_weights
  from public.allocation_shares where rule_version_id = v_rule.id;

  v_share_amounts := public.split_by_weights_centavos(v_base, v_share_weights);

  v_share_idx := 0;
  for v_share in
    select * from public.allocation_shares where rule_version_id = v_rule.id order by key
  loop
    v_share_idx := v_share_idx + 1;

    if v_share.recipient_behavior = 'org_recipient' then
      v_sequence := v_sequence + 1;
      insert into public.settlement_lines (
        settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label,
        weight_bp, amount_centavos, currency, sequence
      )
      select
        new_settlement_id, v_share.key, v_share.recipient_behavior, org.name, null, v_share.label,
        10000, v_share_amounts[v_share_idx], v_rule.currency, v_sequence
      from public.organizations org where org.id = v_share.recipient_org_id;
    else
      select array_agg(a.weight_bp order by a.member_id) into v_participant_weights
      from public.assignments a
      where a.opportunity_id = p_opportunity_id and a.role_key = v_share.key and a.status = 'approved';

      v_participant_amounts := public.split_by_weights_centavos(v_share_amounts[v_share_idx], v_participant_weights);

      v_participant_idx := 0;
      for v_participant in
        select a.member_id, a.role_label, a.weight_bp, m.display_name
        from public.assignments a
        join public.members m on m.id = a.member_id
        where a.opportunity_id = p_opportunity_id and a.role_key = v_share.key and a.status = 'approved'
        order by a.member_id
      loop
        v_participant_idx := v_participant_idx + 1;
        v_sequence := v_sequence + 1;
        insert into public.settlement_lines (
          settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label,
          weight_bp, amount_centavos, currency, sequence
        ) values (
          new_settlement_id, v_share.key, v_share.recipient_behavior, v_participant.display_name,
          v_participant.member_id, v_participant.role_label, v_participant.weight_bp,
          v_participant_amounts[v_participant_idx], v_rule.currency, v_sequence
        );
      end loop;
    end if;
  end loop;

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id, caller_id, 'approve_settlement', 'settlements', new_settlement_id,
    format('Founder approved a settlement of %s %s', v_base, v_rule.currency)
  );

  return query select new_settlement_id, false;
end;
$$;

revoke execute on function public.approve_settlement(uuid, uuid, text) from public;
grant execute on function public.approve_settlement(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- reverse_settlement — builds the exact signed mirror of an approved
-- original: same base, same complete line multiset, every amount negated.
-- The settlements_reversal_lines_exact / settlement_lines_reversal_lines_exact
-- deferred constraints (finance migration) independently re-verify this at
-- commit; this function does not rely on its own arithmetic being trusted.
-- No adjustment write path exists here or anywhere else.
-- ---------------------------------------------------------------------------

create or replace function public.reverse_settlement(
  p_org_id uuid,
  p_settlement_id uuid,
  p_idempotency_key text
)
returns table (settlement_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  original public.settlements;
  existing public.settlements;
  new_id uuid;
  v_line public.settlement_lines;
  v_sequence integer := 0;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: reverse_settlement';
  end if;

  select * into original from public.settlements where id = p_settlement_id;
  if original.id is null then
    raise exception 'settlement % does not exist', p_settlement_id;
  end if;
  if public.org_id_for_settlement(original.id) <> p_org_id then
    raise exception 'settlement % does not belong to org %', p_settlement_id, p_org_id;
  end if;
  if original.kind <> 'original' or original.status <> 'approved' then
    raise exception 'settlement % is not an approved original and cannot be reversed', p_settlement_id;
  end if;

  select * into existing from public.settlements
  where opportunity_id = original.opportunity_id and idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.kind <> 'reversal' or existing.corrects_settlement_id <> p_settlement_id then
      raise exception
        'idempotency key % was already used for a different reversal request', p_idempotency_key;
    end if;
    return query select existing.id, true;
    return;
  end if;

  if exists (
    select 1 from public.settlements r
    where r.corrects_settlement_id = original.id and r.kind = 'reversal' and r.status = 'approved'
  ) then
    raise exception 'settlement % has already been reversed', p_settlement_id;
  end if;

  insert into public.settlements (
    opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id,
    base_centavos, currency, approved_at, approved_by_member_id, idempotency_key
  ) values (
    original.opportunity_id, original.allocation_rule_version_id, 'approved', 'reversal', original.id,
    -original.base_centavos, original.currency, now(), caller_id, p_idempotency_key
  )
  returning id into new_id;

  -- Table-qualified: this function's own `returns table (settlement_id ...)`
  -- declares settlement_id as an out parameter in scope here, which would
  -- otherwise make an unqualified `settlement_id = ...` ambiguous between
  -- that parameter and the settlement_lines column of the same name.
  for v_line in
    select * from public.settlement_lines sl where sl.settlement_id = original.id order by sl.sequence
  loop
    v_sequence := v_sequence + 1;
    insert into public.settlement_lines (
      settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label,
      weight_bp, amount_centavos, currency, sequence
    ) values (
      new_id, v_line.share_key, v_line.recipient_behavior, v_line.recipient_label, v_line.member_id,
      v_line.role_label, v_line.weight_bp, -v_line.amount_centavos, v_line.currency, v_sequence
    );
  end loop;

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id, caller_id, 'reverse_settlement', 'settlements', new_id,
    format('Founder reversed settlement %s', original.id)
  );

  return query select new_id, false;
end;
$$;

revoke execute on function public.reverse_settlement(uuid, uuid, text) from public;
grant execute on function public.reverse_settlement(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_payout — the only door onto settlement_line_payouts.
--
-- p_allocations is a jsonb array of {"settlementLineId": uuid,
-- "amountCentavos": bigint}. With p_existing_cash_event_id null, this
-- creates a brand-new payout cash event and requires every allocation to be
-- strictly positive (a fresh disbursement of new money). With
-- p_existing_cash_event_id set, no new cash event is created — the batch is
-- a signed reallocation against that historical event and must net to
-- exactly zero, which is the reverse-and-reissue transfer pattern (negative
-- off the old line, equal positive onto the replacement line).
--
-- Idempotency is anchored on each allocation's own row: allocation i of a
-- call gets idempotency_key = p_idempotency_key || ':' || i. A replay must
-- match the original call's allocation count and every (line, amount, event)
-- exactly, or it is a deterministic conflict.
-- ---------------------------------------------------------------------------

create or replace function public.record_payout(
  p_org_id uuid,
  p_opportunity_id uuid,
  p_label text,
  p_occurred_at date,
  p_allocations jsonb,
  p_idempotency_key text,
  p_existing_cash_event_id uuid default null
)
returns table (cash_event_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  v_alloc jsonb;
  v_idx integer;
  v_line_id uuid;
  v_amount bigint;
  v_sum bigint := 0;
  v_currency text;
  v_line public.settlement_lines;
  v_existing_event public.cash_events;
  v_existing_alloc public.settlement_line_payouts;
  v_existing_count integer;
  new_event_id uuid;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: record_payout';
  end if;

  if public.org_id_for_opportunity(p_opportunity_id) <> p_org_id then
    raise exception 'opportunity % does not belong to org %', p_opportunity_id, p_org_id;
  end if;

  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'record_payout requires a non-empty allocations array';
  end if;

  for v_idx in 0..jsonb_array_length(p_allocations) - 1 loop
    v_alloc := p_allocations -> v_idx;
    v_amount := (v_alloc ->> 'amountCentavos')::bigint;
    if v_amount = 0 then
      raise exception 'allocation % has a zero amount', v_idx;
    end if;
    if p_existing_cash_event_id is null and v_amount < 0 then
      raise exception 'a fresh payout event may only carry positive allocations (allocation %)', v_idx;
    end if;
    v_sum := v_sum + v_amount;
  end loop;

  if p_existing_cash_event_id is null and v_sum <= 0 then
    raise exception 'a fresh payout event must disburse a positive total';
  end if;
  if p_existing_cash_event_id is not null and v_sum <> 0 then
    raise exception 'a reallocation against an existing payout event must net to zero, got %', v_sum;
  end if;

  -- Idempotency check: look for allocation 0's row under this key first.
  select * into v_existing_alloc
  from public.settlement_line_payouts where idempotency_key = p_idempotency_key || ':0';

  if v_existing_alloc.id is not null then
    select count(*) into v_existing_count
    from public.settlement_line_payouts
    where idempotency_key like (p_idempotency_key || ':%');
    if v_existing_count <> jsonb_array_length(p_allocations) then
      raise exception
        'idempotency key % was already used with a different number of allocations', p_idempotency_key;
    end if;

    for v_idx in 0..jsonb_array_length(p_allocations) - 1 loop
      v_alloc := p_allocations -> v_idx;
      v_line_id := (v_alloc ->> 'settlementLineId')::uuid;
      v_amount := (v_alloc ->> 'amountCentavos')::bigint;
      select * into v_existing_alloc
      from public.settlement_line_payouts where idempotency_key = p_idempotency_key || ':' || v_idx::text;
      if v_existing_alloc.id is null
        or v_existing_alloc.settlement_line_id <> v_line_id
        or v_existing_alloc.amount_centavos <> v_amount
        or (p_existing_cash_event_id is not null and v_existing_alloc.payout_cash_event_id <> p_existing_cash_event_id)
      then
        raise exception
          'idempotency key % was already used for a different payout request', p_idempotency_key;
      end if;
    end loop;

    return query select v_existing_alloc.payout_cash_event_id, true;
    return;
  end if;

  v_alloc := p_allocations -> 0;
  v_line_id := (v_alloc ->> 'settlementLineId')::uuid;
  select * into v_line from public.settlement_lines where id = v_line_id;
  if v_line.id is null then
    raise exception 'allocation references a nonexistent settlement line %', v_line_id;
  end if;
  v_currency := v_line.currency;

  if p_existing_cash_event_id is null then
    insert into public.cash_events (opportunity_id, type, label, amount_centavos, currency, occurred_at, idempotency_key)
    values (p_opportunity_id, 'payout', p_label, -v_sum, v_currency, p_occurred_at, p_idempotency_key)
    returning id into new_event_id;
  else
    select * into v_existing_event from public.cash_events where id = p_existing_cash_event_id;
    if v_existing_event.id is null or v_existing_event.type <> 'payout' then
      raise exception 'existing payout event % not found', p_existing_cash_event_id;
    end if;
    if v_existing_event.opportunity_id <> p_opportunity_id then
      raise exception
        'existing payout event % does not belong to opportunity %', p_existing_cash_event_id, p_opportunity_id;
    end if;
    new_event_id := p_existing_cash_event_id;
  end if;

  for v_idx in 0..jsonb_array_length(p_allocations) - 1 loop
    v_alloc := p_allocations -> v_idx;
    v_line_id := (v_alloc ->> 'settlementLineId')::uuid;
    v_amount := (v_alloc ->> 'amountCentavos')::bigint;

    insert into public.settlement_line_payouts (
      settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key
    ) values (
      v_line_id, new_event_id, v_amount, v_currency, caller_id, p_idempotency_key || ':' || v_idx::text
    );
  end loop;

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id, caller_id, 'record_payout', 'cash_events', new_event_id,
    format(
      'Founder recorded %s payout allocation(s) totaling %s %s',
      jsonb_array_length(p_allocations), abs(v_sum), v_currency
    )
  );

  return query select new_event_id, false;
end;
$$;

revoke execute on function public.record_payout(uuid, uuid, text, date, jsonb, text, uuid) from public;
grant execute on function public.record_payout(uuid, uuid, text, date, jsonb, text, uuid) to authenticated;
