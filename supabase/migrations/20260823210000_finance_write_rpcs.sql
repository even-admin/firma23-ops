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
-- revoked, and unauthenticated callers by construction); revokes execute
-- from both PUBLIC and anon and grants only authenticated; rejects a null,
-- blank, or unreasonably long idempotency key at the boundary; and appends
-- exactly one audit_events row in the same transaction as its real write
-- (never on a pure idempotent replay, which performs no write at all).
--
-- All four RPCs take `select ... for update` on the affected opportunity
-- row after resolving/validating authorization and ownership, and before
-- any state-dependent read, holding the lock to commit. This is what
-- actually makes their idempotency and invariant checks safe: `insert ...
-- on conflict do nothing` only protects two callers using the *same*
-- idempotency key: it cannot stop two callers with *different* keys from
-- both passing a plain-read invariant check before either commits (the
-- same TOCTOU shape as the key race, just varying a different,
-- wrongly-assumed-safe dimension). The lock serializes every write against
-- a given opportunity, which closes that gap for every check that follows
-- it, not just the one instance a stress test happened to sample.
--
-- record_cash_event's own base-drift guard is the concrete case this
-- protects: without the lock, a concurrent approve_settlement could derive
-- and commit its base in the gap between the guard's read and the
-- INSERT — the guard would have correctly seen "no active settlement yet"
-- a moment before one existed. The lock closes that gap by forcing the two
-- calls to fully serialize; it does not rely on the incidental FOR KEY
-- SHARE lock the cash_events FK check takes, which only happened to
-- protect the opposite interleaving (insert-then-approve).
--
-- record_cash_event takes only the opportunity lock, never a line lock —
-- global lock order across all four RPCs stays opportunity, then lines
-- only where needed (record_payout alone takes the second level).
--
-- Additive only. No table created in migrations 20260821090000-090500 is
-- altered in a way that changes any existing row's meaning: cash_events and
-- settlements each gain a NOT NULL idempotency_key column (scripts/
-- generate-seed.mjs supplies a deterministic one for every seeded row, so
-- this is safe against a from-zero apply), and a new payout_command_receipts
-- table replaces per-allocation LIKE-based counting for record_payout's
-- idempotency with one structured receipt per call.

alter table public.cash_events add column idempotency_key text not null;
alter table public.cash_events add constraint cash_events_opportunity_idempotency unique (opportunity_id, idempotency_key);

alter table public.settlements add column idempotency_key text not null;
alter table public.settlements add constraint settlements_opportunity_idempotency unique (opportunity_id, idempotency_key);

-- ---------------------------------------------------------------------------
-- payout_command_receipts — one row per successful record_payout call
-- (never per allocation), scoped by org AND opportunity so a key collision
-- cannot leak or lock out another organization's namespace (M3) and cannot
-- race across two opportunities in the same org either (R3): record_payout
-- locks one opportunity at a time, so uniqueness scoped to only (org_id,
-- idempotency_key) let two concurrent calls against DIFFERENT
-- opportunities, sharing an org and key, both pass this table's lookup
-- (neither call's lock blocked the other) and collide instead on the
-- unrelated global unique index on settlement_line_payouts.idempotency_key
-- — a raw uniqueness failure instead of a clean idempotency decision.
-- Scoping the receipt (and the per-allocation key below) by opportunity_id
-- too makes the uniqueness domain match the lock domain: two different
-- opportunities can never collide, concurrently or sequentially, matching
-- how cash_events and settlements already scope their own keys.
--
-- Replaces the previous `idempotency_key like (:prefix || ':%')` count
-- (M2), which both invited LIKE-metacharacter injection from a
-- client-chosen key and required a separate row per allocation to
-- reconstruct "was this exact request already handled."
-- ---------------------------------------------------------------------------

create table public.payout_command_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  opportunity_id uuid not null references public.opportunities(id),
  idempotency_key text not null,
  request_fingerprint text not null,
  payout_cash_event_id uuid not null references public.cash_events(id),
  allocation_ids uuid[] not null,
  created_at timestamptz not null default now(),
  unique (org_id, opportunity_id, idempotency_key)
);

alter table public.payout_command_receipts enable row level security;

create policy payout_command_receipts_select_founder on public.payout_command_receipts
  for select
  using (public.is_active_founder(org_id));

-- No insert policy: only record_payout (SECURITY DEFINER) writes this table.

-- ---------------------------------------------------------------------------
-- Explicit anon revokes for every existing SECURITY DEFINER function.
--
-- architecture-decision.md's write doctrine requires "revoke PUBLIC and
-- anon execution, grant only the intended authenticated role" for these
-- RPCs specifically, but the same gap existed for every prior migration's
-- helper functions: each one only ever revoked from PUBLIC. Revoking from
-- PUBLIC removes only the privilege a role holds *via* PUBLIC — Supabase's
-- real default privileges grant EXECUTE on new functions to anon
-- *explicitly*, which a PUBLIC-only revoke never touches. Until now this
-- was undetectable: the harness's own stub granted EXECUTE to authenticated
-- alone, so it was more conservative than a real project and could not see
-- the gap it was hiding. The stub now mirrors Supabase's actual default
-- (`grant execute on functions to anon, authenticated`), which is what
-- makes the revokes below load-bearing rather than a no-op.
--
-- These are standalone privilege statements — no function body changes, no
-- risk of altering behavior — issued here rather than by editing the
-- already-reviewed migrations that originally created each function.
-- ---------------------------------------------------------------------------

revoke execute on function public.current_member_id() from anon;
revoke execute on function public.is_active_founder(uuid) from anon;
revoke execute on function public.is_active_member(uuid) from anon;
revoke execute on function public.org_id_for_opportunity(uuid) from anon;
revoke execute on function public.is_assigned_to_opportunity(uuid) from anon;
revoke execute on function public.org_id_for_milestone(uuid) from anon;
revoke execute on function public.is_assigned_to_milestone_opportunity(uuid) from anon;
revoke execute on function public.org_id_for_settlement(uuid) from anon;
revoke execute on function public.run_intake(uuid, uuid, text) from anon;
revoke execute on function public.confirm_contract_draft(uuid, uuid, text, text, text) from anon;
revoke execute on function public.discard_contract_draft(uuid, uuid) from anon;
revoke execute on function public.redeem_invite() from anon;

-- ---------------------------------------------------------------------------
-- split_by_weights_centavos — largest-remainder split, exactly mirroring
-- src/lib/money.ts's splitByWeights (same tie-break: remainder desc, then
-- original index asc) so a founder-approved settlement's amounts never
-- disagree with what the same rule would have projected in the UI.
--
-- Pure arithmetic, touches no table, and needs no SECURITY DEFINER — a
-- SECURITY DEFINER caller (approve_settlement) always has implicit execute
-- on a function its own owner owns, regardless of this revoke. Bounded at
-- 1,000 weights: any real rule/pool is a handful of shares or assignees, so
-- this is headroom, not a real limit, and closes an unauthenticated caller's
-- ability to force an arbitrarily large array_fill.
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
  if n > 1000 then
    raise exception 'split_by_weights_centavos refuses more than 1000 weights';
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

revoke execute on function public.split_by_weights_centavos(bigint, integer[]) from public;
grant execute on function public.split_by_weights_centavos(bigint, integer[]) to authenticated;

-- ---------------------------------------------------------------------------
-- guard_settlement_line_payout_insert — re-declared from
-- 20260821090300_finance.sql to add the reversed-settlement guard clause. A
-- reversed original is still, by every column on its own row, an
-- "approved original" — the reversal is a separate row pointing at it via
-- corrects_settlement_id — so the original predicate here admitted a fresh
-- positive payout against a formally voided settlement. This clause is
-- unconditional: it protects the invariant regardless of which RPC, or any
-- future direct write, tries to insert the row.
-- ---------------------------------------------------------------------------

create or replace function public.guard_settlement_line_payout_insert()
returns trigger
language plpgsql
as $$
declare
  line public.settlement_lines;
  settlement public.settlements;
  event public.cash_events;
  is_reversed boolean;
begin
  select * into line from public.settlement_lines where id = new.settlement_line_id;
  if line is null then
    raise exception 'settlement_line_payout % references a nonexistent settlement line', new.id;
  end if;

  select * into settlement from public.settlements where id = line.settlement_id;
  if settlement.status <> 'approved' or settlement.kind <> 'original' then
    raise exception 'settlement_line_payout % must target a line of an approved original settlement', new.id;
  end if;

  select exists (
    select 1 from public.settlements r
    where r.corrects_settlement_id = settlement.id and r.kind = 'reversal' and r.status = 'approved'
  ) into is_reversed;

  -- A negative (transfer-away) allocation against a reversed settlement's
  -- line is legitimate — record_payout's existing-event mode uses exactly
  -- that to move stranded payout money onto a replacement settlement. Only
  -- a *new positive* allocation against a voided settlement is refused here;
  -- record_payout separately requires that negative to be paired with an
  -- equal positive landing on an active settlement's line.
  if is_reversed and new.amount_centavos > 0 then
    raise exception
      'settlement_line_payout % cannot post a new positive allocation against reversed settlement %',
      new.id, settlement.id;
  end if;

  select * into event from public.cash_events where id = new.payout_cash_event_id;
  if event is null or event.type <> 'payout' then
    raise exception 'settlement_line_payout % must reference a payout cash event', new.id;
  end if;

  -- A payout event can only ever pay lines that belong to its own
  -- opportunity. Without this, a payout cash event posted on opportunity A
  -- could fund a settlement line on opportunity B.
  if event.opportunity_id <> settlement.opportunity_id then
    raise exception
      'settlement_line_payout % cannot pay a line on opportunity % from a cash event on opportunity %',
      new.id, settlement.opportunity_id, event.opportunity_id;
  end if;

  if line.currency <> event.currency or line.currency <> new.currency then
    raise exception 'settlement_line_payout % currency must match its line and cash event', new.id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_cash_event — the only door for invoice/withholding/deposit/
-- contribution/adjustment facts. Never payout: that is record_payout()'s
-- door alone, so a payout can never exist without its allocations in the
-- same atomic write. Refuses a cancelled opportunity, a currency other than
-- the opportunity's own snapshotted rule currency, and — for a type the
-- rule's base_policy actually counts — an opportunity that already has an
-- active approved settlement, so an approved base can never silently drift
-- after the fact. Takes the opportunity lock before that drift guard so the
-- guard is an actual invariant, not a TOCTOU-vulnerable read a concurrent
-- approve_settlement can slip past.
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
set search_path = public, pg_temp
as $$
declare
  caller_id uuid;
  existing public.cash_events;
  new_id uuid;
  v_opportunity_status text;
  v_rule_currency text;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: record_cash_event';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception 'a valid idempotency key is required';
  end if;

  if public.org_id_for_opportunity(p_opportunity_id) is distinct from p_org_id then
    raise exception 'opportunity % does not belong to org %', p_opportunity_id, p_org_id;
  end if;

  if p_type = 'payout' then
    raise exception 'record_cash_event cannot create a payout event; use record_payout';
  end if;

  -- Serialize against approve_settlement, reverse_settlement, and every
  -- other concurrent record_cash_event/record_payout call on this same
  -- opportunity, held to commit. Without this, the drift guard below is a
  -- plain read: a concurrent approve_settlement could derive and commit its
  -- base in the window between this guard's read and this function's own
  -- INSERT, seeing "no active settlement yet" a moment before one existed.
  perform 1 from public.opportunities where id = p_opportunity_id for update;

  -- Idempotent replay first: a retry of an already-recorded event must
  -- still succeed even if the opportunity has since been cancelled or
  -- approved — only a genuinely new event is subject to the checks below.
  select * into existing from public.cash_events
  where opportunity_id = p_opportunity_id and idempotency_key = p_idempotency_key;
  if existing.id is not null then
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

  select status into v_opportunity_status from public.opportunities where id = p_opportunity_id;
  if v_opportunity_status = 'cancelled' then
    raise exception 'opportunity % is cancelled and cannot receive cash events', p_opportunity_id;
  end if;

  select arv.currency into v_rule_currency
  from public.opportunities o
  join public.allocation_rule_versions arv on arv.id = o.allocation_rule_version_id
  where o.id = p_opportunity_id;

  if v_rule_currency is null then
    raise exception 'opportunity % has no resolvable allocation rule version', p_opportunity_id;
  end if;
  if p_currency <> v_rule_currency then
    raise exception
      'cash event currency % does not match this opportunity''s rule currency %', p_currency, v_rule_currency;
  end if;

  if p_type in (
    select jsonb_array_elements_text(arv.base_policy -> 'includeTypes')
    from public.opportunities o
    join public.allocation_rule_versions arv on arv.id = o.allocation_rule_version_id
    where o.id = p_opportunity_id
  ) and exists (
    select 1 from public.settlements s
    where s.opportunity_id = p_opportunity_id and s.kind = 'original' and s.status = 'approved'
      and not exists (
        select 1 from public.settlements r
        where r.corrects_settlement_id = s.id and r.kind = 'reversal' and r.status = 'approved'
      )
  ) then
    raise exception
      'opportunity % already has an active approved settlement; a new base-contributing % event would drift its already-approved base',
      p_opportunity_id, p_type;
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
revoke execute on function public.record_cash_event(uuid, uuid, text, text, bigint, text, date, text) from anon;
grant execute on function public.record_cash_event(uuid, uuid, text, text, bigint, text, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- approve_settlement — the client submits only an opportunity id. Every
-- money figure is derived here from the opportunity's own snapshotted rule
-- version, its base_policy-selected cash events, its allocation_shares, and
-- its approved assignments — never from a client-submitted base or line
-- amount. Fails outright if any required member_pool is not exactly
-- 10,000bp, any org_recipient has no resolvable organization, or the
-- opportunity is cancelled.
-- ---------------------------------------------------------------------------

create or replace function public.approve_settlement(
  p_org_id uuid,
  p_opportunity_id uuid,
  p_idempotency_key text
)
returns table (settlement_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid;
  existing public.settlements;
  v_rule public.allocation_rule_versions;
  v_opportunity_status text;
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

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception 'a valid idempotency key is required';
  end if;

  if public.org_id_for_opportunity(p_opportunity_id) is distinct from p_org_id then
    raise exception 'opportunity % does not belong to org %', p_opportunity_id, p_org_id;
  end if;

  -- Serialize every approve_settlement/reverse_settlement/record_payout call
  -- against this opportunity, held to commit. Every read below is then a
  -- consistent read of state no concurrent call on this same opportunity
  -- can change out from under it — this, not the ON CONFLICT below, is what
  -- makes "two different idempotency keys both pass the active-settlement
  -- check" impossible.
  perform 1 from public.opportunities where id = p_opportunity_id for update;

  select status into v_opportunity_status from public.opportunities where id = p_opportunity_id;
  if v_opportunity_status = 'cancelled' then
    raise exception 'opportunity % is cancelled and cannot be approved', p_opportunity_id;
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

  -- Excludes a settlement carrying our own idempotency key: a concurrent
  -- twin of this exact request must resolve to the idempotent-replay path
  -- below, not be mistaken for a second, genuinely different approval.
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
  -- v_base = 0 is intentionally allowed: a real opportunity with no
  -- base-contributing cash events yet can still be approved at zero, which
  -- is a legitimate (and reversible) state, not an error condition.

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

  -- Atomic upsert as defense-in-depth: the opportunity lock above already
  -- makes this insert race-free (no concurrent caller for this opportunity
  -- can be mid-flight), but ON CONFLICT still protects the sequential-replay
  -- case if that ordering assumption is ever violated by a future change.
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
revoke execute on function public.approve_settlement(uuid, uuid, text) from anon;
grant execute on function public.approve_settlement(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- reverse_settlement — builds the exact signed mirror of an approved
-- original: same base, same complete line multiset, every amount negated.
-- The settlements_reversal_lines_exact / settlement_lines_reversal_lines_exact
-- deferred constraints (finance migration) independently re-verify this at
-- commit; this function does not rely on its own arithmetic being trusted.
-- No adjustment write path exists here or anywhere else.
--
-- Does NOT require a paid line's allocations to net to zero as part of this
-- transaction — that would force reversal and reallocation into a single
-- all-or-nothing call, which is not how a founder actually corrects a paid
-- settlement across two separate, auditable actions. Instead: payout
-- allocations already made are preserved as historical fact, the outstanding
-- (not-yet-reallocated) amount is reported back so nothing is silently lost
-- track of, and guard_settlement_line_payout_insert independently blocks any
-- *new* positive allocation against the now-reversed settlement.
--
-- This is reported, not required to be resolved: no constraint, queue, or
-- schedule forces a founder to ever reallocate a stranded payout. A
-- founder-visible "reversed settlements with outstanding payout
-- allocations" surface is explicitly DEFERRED to the final founder finance
-- UI, not part of this pass (which adds no UI). outstandingPayoutCentavos
-- is preserved end to end — this RPC's own return column, through to
-- ReverseSettlementResult (src/types/views.ts) — specifically so that
-- surface has a value to read once it exists.
-- ---------------------------------------------------------------------------

create or replace function public.reverse_settlement(
  p_org_id uuid,
  p_settlement_id uuid,
  p_idempotency_key text
)
returns table (settlement_id uuid, replayed boolean, outstanding_payout_centavos bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid;
  original public.settlements;
  existing public.settlements;
  new_id uuid;
  v_line public.settlement_lines;
  v_sequence integer := 0;
  v_outstanding bigint;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: reverse_settlement';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception 'a valid idempotency key is required';
  end if;

  select * into original from public.settlements where id = p_settlement_id;
  if original.id is null then
    raise exception 'settlement % does not exist', p_settlement_id;
  end if;
  if public.org_id_for_settlement(original.id) is distinct from p_org_id then
    raise exception 'settlement % does not belong to org %', p_settlement_id, p_org_id;
  end if;

  -- Serialize against approve_settlement/record_payout/other reversals on
  -- this same opportunity before any state-dependent check below.
  perform 1 from public.opportunities where id = original.opportunity_id for update;

  if original.kind <> 'original' or original.status <> 'approved' then
    raise exception 'settlement % is not an approved original and cannot be reversed', p_settlement_id;
  end if;

  select * into existing from public.settlements
  where opportunity_id = original.opportunity_id and idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.kind <> 'reversal' or existing.corrects_settlement_id is distinct from p_settlement_id then
      raise exception
        'idempotency key % was already used for a different reversal request', p_idempotency_key;
    end if;
    select coalesce(sum(p.amount_centavos), 0) into v_outstanding
    from public.settlement_line_payouts p
    join public.settlement_lines l on l.id = p.settlement_line_id
    where l.settlement_id = original.id;
    return query select existing.id, true, v_outstanding;
    return;
  end if;

  if exists (
    select 1 from public.settlements r
    where r.corrects_settlement_id = original.id and r.kind = 'reversal' and r.status = 'approved'
  ) then
    raise exception 'settlement % has already been reversed', p_settlement_id;
  end if;

  -- Outstanding payout money still attached to the original's lines at the
  -- moment of reversal: reported, not blocked. Correctable afterward via
  -- record_payout's existing-event transfer mode, in its own transaction.
  select coalesce(sum(p.amount_centavos), 0) into v_outstanding
  from public.settlement_line_payouts p
  join public.settlement_lines l on l.id = p.settlement_line_id
  where l.settlement_id = original.id;

  insert into public.settlements (
    opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id,
    base_centavos, currency, approved_at, approved_by_member_id, idempotency_key
  ) values (
    original.opportunity_id, original.allocation_rule_version_id, 'approved', 'reversal', original.id,
    -original.base_centavos, original.currency, now(), caller_id, p_idempotency_key
  )
  on conflict (opportunity_id, idempotency_key) do nothing
  returning id into new_id;

  if new_id is null then
    select * into existing from public.settlements
    where opportunity_id = original.opportunity_id and idempotency_key = p_idempotency_key;
    if existing.kind <> 'reversal' or existing.corrects_settlement_id is distinct from p_settlement_id then
      raise exception
        'idempotency key % was already used for a different reversal request', p_idempotency_key;
    end if;
    return query select existing.id, true, v_outstanding;
    return;
  end if;

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
    case
      when v_outstanding > 0 then
        format(
          'Founder reversed settlement %s; %s %s in prior payouts now requires reallocation',
          original.id, v_outstanding, original.currency
        )
      else format('Founder reversed settlement %s', original.id)
    end
  );

  return query select new_id, false, v_outstanding;
end;
$$;

revoke execute on function public.reverse_settlement(uuid, uuid, text) from public;
revoke execute on function public.reverse_settlement(uuid, uuid, text) from anon;
grant execute on function public.reverse_settlement(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_payout — the only door onto settlement_line_payouts.
--
-- p_allocations is a jsonb array of objects, each with exactly
-- settlementLineId (a UUID string) and amountCentavos (an integer) — no
-- other shape is accepted, and a duplicate settlementLineId within one
-- batch is rejected outright.
--
-- With p_existing_cash_event_id null, this creates a brand-new payout cash
-- event and requires every allocation to be strictly positive (a fresh
-- disbursement of new money). With p_existing_cash_event_id set, no new
-- cash event is created — the batch is a signed reallocation against that
-- historical event and must net to exactly zero. A negative allocation in
-- this mode may only target a *reversed* settlement's line, and only when
-- matched exactly by an equal positive allocation onto an *active*
-- (unreversed, approved, original) settlement's line — the
-- reverse-and-reissue transfer this product actually performs.
--
-- Idempotency is one payout_command_receipts row per call (never per
-- allocation), scoped by (org, opportunity) — matching cash_events and
-- settlements, and matching the single opportunity this function locks per
-- call, so a reused key can never race across two opportunities either.
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
set search_path = public, pg_temp
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
  v_receipt public.payout_command_receipts;
  new_event_id uuid;
  v_fingerprint text;
  v_all_line_ids uuid[] := array[]::uuid[];
  v_distinct_count integer;
  v_line_check record;
  v_reversed_negative_total bigint := 0;
  v_active_positive_total bigint := 0;
  v_affected_line_ids uuid[] := array[]::uuid[];
  v_gross_amount bigint := 0;
begin
  caller_id := public.current_member_id();
  if caller_id is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: record_payout';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception 'a valid idempotency key is required';
  end if;

  if public.org_id_for_opportunity(p_opportunity_id) is distinct from p_org_id then
    raise exception 'opportunity % does not belong to org %', p_opportunity_id, p_org_id;
  end if;

  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'record_payout requires a non-empty allocations array';
  end if;

  -- Validate exact shape, type, and sign for every allocation before
  -- touching any table: a missing or malformed field must name itself, not
  -- surface as a NULL that happens to slip past a later numeric comparison.
  for v_idx in 0..jsonb_array_length(p_allocations) - 1 loop
    v_alloc := p_allocations -> v_idx;
    if jsonb_typeof(v_alloc) <> 'object' then
      raise exception 'allocation % must be a JSON object', v_idx;
    end if;
    if not (v_alloc ? 'settlementLineId' and v_alloc ? 'amountCentavos')
      or (select count(*) from jsonb_object_keys(v_alloc)) <> 2
    then
      raise exception 'allocation % must have exactly settlementLineId and amountCentavos', v_idx;
    end if;
    if jsonb_typeof(v_alloc -> 'settlementLineId') <> 'string' then
      raise exception 'allocation % settlementLineId must be a string', v_idx;
    end if;
    begin
      v_line_id := (v_alloc ->> 'settlementLineId')::uuid;
    exception when invalid_text_representation then
      raise exception 'allocation % settlementLineId is not a valid UUID', v_idx;
    end;
    if jsonb_typeof(v_alloc -> 'amountCentavos') <> 'number' then
      raise exception 'allocation % amountCentavos must be a number', v_idx;
    end if;
    v_amount := (v_alloc ->> 'amountCentavos')::bigint;
    if (v_alloc ->> 'amountCentavos')::numeric <> v_amount then
      raise exception 'allocation % amountCentavos must be an integer', v_idx;
    end if;
    if v_amount = 0 then
      raise exception 'allocation % has a zero amount', v_idx;
    end if;
    if p_existing_cash_event_id is null and v_amount < 0 then
      raise exception 'a fresh payout event may only carry positive allocations (allocation %)', v_idx;
    end if;
    v_sum := v_sum + v_amount;
    v_all_line_ids := v_all_line_ids || v_line_id;
  end loop;

  select count(distinct x) into v_distinct_count from unnest(v_all_line_ids) as x;
  if v_distinct_count <> array_length(v_all_line_ids, 1) then
    raise exception 'record_payout does not permit duplicate settlementLineId values in one batch';
  end if;

  if p_existing_cash_event_id is null and v_sum <= 0 then
    raise exception 'a fresh payout event must disburse a positive total';
  end if;
  if p_existing_cash_event_id is not null and v_sum <> 0 then
    raise exception 'a reallocation against an existing payout event must net to zero, got %', v_sum;
  end if;

  -- Serialize against approve_settlement, reverse_settlement, and every
  -- other concurrent record_payout call on this same opportunity, held to
  -- commit — this is what makes the reversed/active pairing check and the
  -- idempotency receipt check below safe reads.
  perform 1 from public.opportunities where id = p_opportunity_id for update;

  -- Lock every targeted line, in a fixed (id) order, so two overlapping
  -- batches naturally serialize against each other instead of both reading
  -- a stale allocated total and overpaying the same line.
  perform 1 from public.settlement_lines where id = any(v_all_line_ids) order by id for update;

  -- A negative allocation may only ever leave a reversed settlement's line,
  -- and only when matched by an equal positive allocation onto an active
  -- (unreversed, approved, original) settlement's line — enforced below,
  -- not merely assumed. A *positive* allocation onto a reversed line is
  -- rejected unconditionally by guard_settlement_line_payout_insert
  -- regardless of this check.
  for v_idx in 0..jsonb_array_length(p_allocations) - 1 loop
    v_alloc := p_allocations -> v_idx;
    v_line_id := (v_alloc ->> 'settlementLineId')::uuid;
    v_amount := (v_alloc ->> 'amountCentavos')::bigint;

    select
      exists (
        select 1 from public.settlements r
        where r.corrects_settlement_id = sl.settlement_id and r.kind = 'reversal' and r.status = 'approved'
      ) as is_reversed
    into v_line_check
    from public.settlement_lines sl
    where sl.id = v_line_id;

    -- Outright rejection, not silent exclusion from both totals: without
    -- this, a negative allocation off an active line matches neither the
    -- reversed-negative nor the active-positive bucket, so it is invisible
    -- to the balance check below and money can be redirected between two
    -- active lines of the same opportunity with no reversal involved.
    if not v_line_check.is_reversed and v_amount < 0 then
      raise exception
        'a negative allocation may only leave a reversed settlement''s line (allocation %, line %)',
        v_idx, v_line_id;
    end if;

    if v_line_check.is_reversed and v_amount < 0 then
      v_reversed_negative_total := v_reversed_negative_total + (-v_amount);
    elsif not v_line_check.is_reversed and v_amount > 0 then
      v_active_positive_total := v_active_positive_total + v_amount;
    end if;
  end loop;

  if v_reversed_negative_total > 0 and v_reversed_negative_total <> v_active_positive_total then
    raise exception
      'a reallocation away from a reversed settlement must be matched by an equal positive allocation onto an active settlement';
  end if;

  -- Idempotency: one receipt row per call, never per allocation, scoped by
  -- (org_id, opportunity_id) so no cross-tenant key collision or lockout is
  -- possible, and no cross-opportunity race within the same org either
  -- (R3) — matching the lock this function already holds on exactly one
  -- opportunity at a time.
  v_fingerprint := coalesce(p_opportunity_id::text, '') || '|' || coalesce(p_label, '') || '|'
    || coalesce(p_occurred_at::text, '') || '|' || p_allocations::text || '|'
    || coalesce(p_existing_cash_event_id::text, '');

  select * into v_receipt from public.payout_command_receipts
  where org_id = p_org_id and opportunity_id = p_opportunity_id and idempotency_key = p_idempotency_key;

  if v_receipt.id is not null then
    if v_receipt.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency key % was already used for a different payout request', p_idempotency_key;
    end if;
    return query select v_receipt.payout_cash_event_id, true;
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
    -- Plain p_idempotency_key, not org-prefixed: cash_events is already
    -- scoped by unique(opportunity_id, idempotency_key), so there is no
    -- cross-org collision to guard against here (unlike
    -- settlement_line_payouts.idempotency_key below, which previously had
    -- no such per-opportunity scoping — that is what M3 was actually about).
    insert into public.cash_events (opportunity_id, type, label, amount_centavos, currency, occurred_at, idempotency_key)
    values (p_opportunity_id, 'payout', p_label, -v_sum, v_currency, p_occurred_at, p_idempotency_key)
    returning id into new_event_id;
  else
    select * into v_existing_event from public.cash_events where id = p_existing_cash_event_id;
    if v_existing_event.id is null or v_existing_event.type <> 'payout' then
      raise exception 'existing payout event % not found', p_existing_cash_event_id;
    end if;
    if v_existing_event.opportunity_id is distinct from p_opportunity_id then
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
      v_line_id, new_event_id, v_amount, v_currency, caller_id,
      p_org_id::text || ':' || p_opportunity_id::text || ':' || p_idempotency_key || ':' || v_idx::text
    );

    v_affected_line_ids := v_affected_line_ids || v_line_id;
    if v_amount > 0 then
      v_gross_amount := v_gross_amount + v_amount;
    end if;
  end loop;

  -- Gross amount actually moved, every affected line, and the event id —
  -- never "totaling 0" for a net-zero reallocation batch (H4), and always
  -- exactly one audit row per call, never one per line.
  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id, caller_id, 'record_payout', 'cash_events', new_event_id,
    format(
      'Founder moved %s %s across %s line(s) (%s) against payout event %s',
      v_gross_amount, v_currency, jsonb_array_length(p_allocations),
      array_to_string(v_affected_line_ids, ', '), new_event_id
    )
  );

  insert into public.payout_command_receipts (
    org_id, opportunity_id, idempotency_key, request_fingerprint, payout_cash_event_id, allocation_ids
  ) values (
    p_org_id, p_opportunity_id, p_idempotency_key, v_fingerprint, new_event_id, v_affected_line_ids
  )
  on conflict (org_id, opportunity_id, idempotency_key) do nothing;
  -- No fallback read needed on conflict: the uniqueness domain now matches
  -- the lock domain exactly (org_id, opportunity_id, idempotency_key), and
  -- this function holds the opportunity lock for the one opportunity in
  -- that tuple for the whole call — no other caller can be racing this
  -- exact key for this exact opportunity, concurrently or otherwise, so
  -- this insert losing a race is not expected in practice. If it somehow
  -- did, the payout work immediately above already committed correctly
  -- under this call's own name — that result, returned below, is
  -- unaffected either way.

  return query select new_event_id, false;
end;
$$;

revoke execute on function public.record_payout(uuid, uuid, text, date, jsonb, text, uuid) from public;
revoke execute on function public.record_payout(uuid, uuid, text, date, jsonb, text, uuid) from anon;
grant execute on function public.record_payout(uuid, uuid, text, date, jsonb, text, uuid) to authenticated;
