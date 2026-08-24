-- FIRMA23 Ops — M2 foundation, part 4: cash events, settlements, settlement
-- lines, and stat events.
--
-- This is the most safety-critical file in the set. Every invariant in
-- docs/ARCHITECTURE.md's "Required invariants" list that mentions money is
-- enforced here at the database layer, not only in the TypeScript allocation
-- engine (src/lib/allocation.ts) that already enforces it for the read path.

-- No ON DELETE CASCADE: cash events are ledger facts, so an opportunity with
-- any posted cash event becomes undeletable (must move to 'cancelled'
-- instead) rather than silently losing its money history.
create table public.cash_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id),
  type text not null check (type in ('invoice', 'withholding', 'deposit', 'contribution', 'adjustment', 'payout')),
  label text not null,
  amount_centavos bigint not null,
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  occurred_at date not null,
  created_at timestamptz not null default now(),
  -- The sign of a cash event is fixed by its type, not left to the writer:
  -- invoice/deposit/contribution are inflows, withholding/payout are
  -- outflows, and a reserved 'adjustment' correction must be non-zero and
  -- carry a real reason in its label.
  constraint cash_events_sign_by_type check (
    case type
      when 'invoice' then amount_centavos > 0
      when 'deposit' then amount_centavos > 0
      when 'contribution' then amount_centavos > 0
      when 'withholding' then amount_centavos < 0
      when 'payout' then amount_centavos < 0
      when 'adjustment' then amount_centavos <> 0 and char_length(trim(label)) > 0
    end
  )
);

alter table public.cash_events enable row level security;

-- org_id_for_opportunity() is defined in the previous migration
-- (20260821090200) and is SECURITY DEFINER, so this lookup bypasses RLS on
-- opportunities/projects instead of re-triggering their policies — the same
-- reason opportunities' and assignments' own policies use it instead of an
-- inline join. See that file's header for the recursion this avoids.
create policy cash_events_select_founder on public.cash_events
  for select
  using (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)));

-- No INSERT policy: canonical cash events are written only by record_cash_event()
-- and record_payout(), added once the audited finance RPCs ship (P3). Until
-- then this table has no write path at all, which is deliberate — an
-- unaudited interim door must not exist just because the RPC isn't built yet.

-- Cash receipts, withholdings, and payouts are a ledger. A correction is a
-- new 'adjustment' row, never an edit of a posted event.
create trigger cash_events_immutable
  before update or delete on public.cash_events
  for each row execute function public.forbid_mutation();

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id),
  allocation_rule_version_id uuid not null references public.allocation_rule_versions(id),
  status text not null check (status in ('pending', 'approved')),
  base_centavos bigint not null,
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  approved_at timestamptz,
  approved_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now(),
  -- kind/corrects_settlement_id make correction a reverse-and-reissue
  -- operation instead of a mutation: 'original' is the first approval on an
  -- opportunity, 'reversal' exactly negates one approved original, and
  -- 'adjustment' is reserved in the enum with no write path in V1 (no
  -- policy, RPC, or repository method creates one).
  kind text not null default 'original' check (kind in ('original', 'reversal', 'adjustment')),
  corrects_settlement_id uuid references public.settlements(id),
  constraint settlements_approval_fields_together check (
    (status = 'approved' and approved_at is not null and approved_by_member_id is not null)
    or (status = 'pending' and approved_at is null and approved_by_member_id is null)
  ),
  constraint settlements_kind_base_sign check (
    (kind = 'original' and base_centavos >= 0)
    or (kind = 'reversal' and base_centavos <= 0)
    or (kind = 'adjustment')
  ),
  constraint settlements_kind_corrects_together check (
    (kind = 'original' and corrects_settlement_id is null)
    or (kind in ('reversal', 'adjustment') and corrects_settlement_id is not null)
  )
);

-- An opportunity may have at most one approved reversal per original — see
-- the deferred "at most one unreversed approved original" constraint trigger
-- below for the complementary half of this rule.
create unique index settlements_one_approved_reversal_per_original
  on public.settlements (corrects_settlement_id)
  where kind = 'reversal' and status = 'approved';

alter table public.settlements enable row level security;

create policy settlements_select_founder on public.settlements
  for select
  using (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)));

-- No INSERT policy: canonical settlements are written only by
-- approve_settlement() and reverse_settlement(), added once the audited
-- finance RPCs ship (P3). Until then this table has no write path at all.

-- A reversal must reference an approved original in the same opportunity,
-- currency, and rule version, so a correction can never quietly cross
-- opportunities, currencies, or rule-version boundaries.
create or replace function public.guard_settlement_reversal_matches_original()
returns trigger
language plpgsql
as $$
declare
  original public.settlements;
begin
  if new.kind <> 'reversal' then
    return new;
  end if;

  select * into original from public.settlements where id = new.corrects_settlement_id;
  if original is null then
    raise exception 'settlement % reverses a nonexistent settlement %', new.id, new.corrects_settlement_id;
  end if;
  if original.kind <> 'original' then
    raise exception 'settlement % may only reverse an original settlement', new.id;
  end if;
  if original.status <> 'approved' then
    raise exception 'settlement % may only reverse an approved settlement', new.id;
  end if;
  if original.opportunity_id <> new.opportunity_id
    or original.currency <> new.currency
    or original.allocation_rule_version_id <> new.allocation_rule_version_id
  then
    raise exception 'settlement % must match its original''s opportunity, currency, and rule version', new.id;
  end if;
  -- Exact reversal: the base itself must be the precise negation, not merely
  -- non-positive. A reversal that only partially offsets its original (or
  -- overshoots it) is not a real correction.
  if new.base_centavos <> -original.base_centavos then
    raise exception
      'settlement % base % must equal the exact negative of original %''s base %',
      new.id, new.base_centavos, original.id, original.base_centavos;
  end if;
  return new;
end;
$$;

create trigger settlements_guard_reversal_matches_original
  before insert on public.settlements
  for each row execute function public.guard_settlement_reversal_matches_original();

-- Invariant: an approved settlement (original or reversal) must carry at
-- least one line, and a reversal's complete line multiset must exactly
-- negate its original's. Comparison is multiset-aware (bidirectional
-- EXCEPT ALL over every descriptive column plus the negated amount), not a
-- join keyed on (share_key, member_id) — a join can be fooled by two lines
-- that legitimately share a key (nothing else requires share_key+member_id
-- to be unique within a settlement); EXCEPT ALL counts occurrences, so a
-- duplicate on one side with no duplicate counterpart on the other is
-- still caught.
--
-- Callable directly (validate_settlement_reversal_exact) so it can be
-- invoked from a trigger on EITHER `settlements` or `settlement_lines`: a
-- reversal is typically approved and given its lines in one transaction,
-- but a line inserted against an already-approved settlement in a later,
-- separate transaction would never re-fire a trigger declared only on
-- `settlements` (that row is immutable once approved and is never touched
-- again) — a trigger on settlement_lines' own inserts is what catches that.
create or replace function public.validate_settlement_reversal_exact(p_settlement_id uuid)
returns void
language plpgsql
as $$
declare
  affected public.settlements;
  line_count integer;
  extra_in_original integer;
  extra_in_reversal integer;
begin
  select * into affected from public.settlements where id = p_settlement_id;
  if affected is null or affected.status <> 'approved' then
    return;
  end if;

  select count(*) into line_count
  from public.settlement_lines
  where settlement_id = affected.id;

  if line_count = 0 then
    raise exception 'approved settlement % has no lines', affected.id;
  end if;

  if affected.kind <> 'reversal' then
    return;
  end if;

  -- Rows present in the original (negated) with no matching occurrence in
  -- the reversal: a missing line, or a line whose currency/amount/metadata
  -- doesn't match.
  select count(*) into extra_in_original
  from (
    select share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, currency,
           -amount_centavos as signed_amount_centavos
    from public.settlement_lines where settlement_id = affected.corrects_settlement_id
    except all
    select share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, currency,
           amount_centavos as signed_amount_centavos
    from public.settlement_lines where settlement_id = affected.id
  ) unmatched_original;

  -- Rows present in the reversal with no matching occurrence in the
  -- original (negated): an extra line, or a duplicate with no duplicate
  -- counterpart on the original side.
  select count(*) into extra_in_reversal
  from (
    select share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, currency,
           amount_centavos as signed_amount_centavos
    from public.settlement_lines where settlement_id = affected.id
    except all
    select share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, currency,
           -amount_centavos as signed_amount_centavos
    from public.settlement_lines where settlement_id = affected.corrects_settlement_id
  ) unmatched_reversal;

  if extra_in_original > 0 or extra_in_reversal > 0 then
    raise exception
      'settlement % (reversal of %) does not exactly negate its original''s line multiset (% missing/mismatched, % extra/mismatched)',
      affected.id, affected.corrects_settlement_id, extra_in_original, extra_in_reversal;
  end if;
end;
$$;

create or replace function public.check_settlement_reversal_exact()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_settlement_reversal_exact(new.id);
  return null;
end;
$$;

create constraint trigger settlements_reversal_lines_exact
  after insert or update on public.settlements
  deferrable initially deferred
  for each row execute function public.check_settlement_reversal_exact();

-- Once approved, a settlement is frozen. Corrections are reversal entries in
-- a future settlement, never a mutation of this row. Invariant 7.
create or replace function public.guard_settlement_update()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' then
    raise exception 'settlement % is approved and immutable', old.id;
  end if;
  return new;
end;
$$;

create trigger settlements_guard_update
  before update on public.settlements
  for each row execute function public.guard_settlement_update();

create trigger settlements_forbid_delete
  before delete on public.settlements
  for each row execute function public.forbid_mutation();

-- Invariant: at most one approved, unreversed original settlement per
-- opportunity at commit. Deferred so a reverse-and-reissue (insert the
-- reversal, then insert the replacement original) can pass through a
-- transient state where the old original is not yet marked reversed by the
-- unique index above, and only has to balance by COMMIT.
create or replace function public.check_one_unreversed_approved_original()
returns trigger
language plpgsql
as $$
declare
  affected_opportunity_id uuid;
  active_count integer;
begin
  affected_opportunity_id := coalesce(new.opportunity_id, old.opportunity_id);

  select count(*) into active_count
  from public.settlements s
  where s.opportunity_id = affected_opportunity_id
    and s.kind = 'original'
    and s.status = 'approved'
    and not exists (
      select 1 from public.settlements r
      where r.corrects_settlement_id = s.id
        and r.kind = 'reversal'
        and r.status = 'approved'
    );

  if active_count > 1 then
    raise exception
      'opportunity % has % unreversed approved original settlements, expected at most 1',
      affected_opportunity_id, active_count;
  end if;
  return null;
end;
$$;

create constraint trigger settlements_one_unreversed_approved_original
  after insert or update on public.settlements
  deferrable initially deferred
  for each row execute function public.check_one_unreversed_approved_original();

create table public.settlement_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  share_key text not null,
  -- Mirrors allocation_shares.recipient_behavior at settlement time:
  -- org_recipient (formerly 'house') or member_pool (formerly 'closer'/
  -- 'delivery_pool').
  recipient_behavior text not null check (recipient_behavior in ('org_recipient', 'member_pool')),
  recipient_label text not null,
  member_id uuid references public.members(id),
  role_label text not null,
  weight_bp integer not null check (weight_bp >= 0 and weight_bp <= 10000),
  amount_centavos bigint not null,
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  -- payout_status/paid_at/payout_cash_event_id are gone: they were mutable
  -- state on a row this table's own immutability trigger already forbids
  -- updating. Paid/unpaid/partial status is now derived from append-only
  -- settlement_line_payouts, below.
  sequence integer not null check (sequence > 0),
  unique (settlement_id, sequence)
);

create or replace function public.org_id_for_settlement(p_settlement_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select public.org_id_for_opportunity(s.opportunity_id)
  from public.settlements s
  where s.id = p_settlement_id;
$$;

revoke execute on function public.org_id_for_settlement(uuid) from public;
grant execute on function public.org_id_for_settlement(uuid) to authenticated;

alter table public.settlement_lines enable row level security;

create policy settlement_lines_select_founder on public.settlement_lines
  for select
  using (public.is_active_founder(public.org_id_for_settlement(settlement_id)));

-- Invariant: "Read their own settlement lines" (docs/ARCHITECTURE.md, Member).
create policy settlement_lines_select_own on public.settlement_lines
  for select
  using (member_id = public.current_member_id());

-- No INSERT policy: canonical settlement lines are written only by
-- approve_settlement(), added once the audited finance RPCs ship (P3). Until
-- then this table has no write path at all.

create trigger settlement_lines_immutable
  before update or delete on public.settlement_lines
  for each row execute function public.forbid_mutation();

-- A line's currency can never disagree with its own settlement's currency —
-- the two currency CHECKs above only validate each column's shape (a valid
-- ISO code), not that the two agree with each other.
create or replace function public.guard_settlement_line_currency()
returns trigger
language plpgsql
as $$
declare
  parent_currency text;
begin
  select currency into parent_currency from public.settlements where id = new.settlement_id;
  if parent_currency is null then
    raise exception 'settlement_line % references a nonexistent settlement', new.id;
  end if;
  if new.currency <> parent_currency then
    raise exception
      'settlement_line % currency % must match its settlement''s currency %',
      new.id, new.currency, parent_currency;
  end if;
  return new;
end;
$$;

create trigger settlement_lines_guard_currency
  before insert on public.settlement_lines
  for each row execute function public.guard_settlement_line_currency();

-- Complements settlements_reversal_lines_exact above: that trigger fires on
-- `settlements` insert/update, so it never re-fires for a line inserted
-- later against an already-approved (and thus immutable) settlement row. A
-- deferred trigger here closes that gap.
create or replace function public.check_settlement_line_reversal_exact()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_settlement_reversal_exact(new.settlement_id);
  return null;
end;
$$;

create constraint trigger settlement_lines_reversal_lines_exact
  after insert on public.settlement_lines
  deferrable initially deferred
  for each row execute function public.check_settlement_line_reversal_exact();

-- Invariant 5: settlement lines sum exactly to the approved base.
create or replace function public.check_settlement_lines_sum()
returns trigger
language plpgsql
as $$
declare
  affected_settlement_id uuid;
  line_total bigint;
  approved_base bigint;
begin
  affected_settlement_id := coalesce(new.settlement_id, old.settlement_id);
  select coalesce(sum(amount_centavos), 0) into line_total
  from public.settlement_lines
  where settlement_id = affected_settlement_id;

  select base_centavos into approved_base
  from public.settlements
  where id = affected_settlement_id;

  if line_total <> approved_base then
    raise exception
      'settlement % lines sum to % but the approved base is %',
      affected_settlement_id, line_total, approved_base;
  end if;
  return null;
end;
$$;

create constraint trigger settlement_lines_sum_matches_base
  after insert on public.settlement_lines
  deferrable initially deferred
  for each row execute function public.check_settlement_lines_sum();

-- ---------------------------------------------------------------------------
-- settlement_line_payouts — append-only partial-payout allocation.
--
-- A settlement line's paid/unpaid/partial status is derived from the signed
-- sum of its allocations here, never stored on the line itself: 0 means
-- unpaid, between 0 and the line amount means partial, and exactly the line
-- amount means paid. Reverse-and-reissue for a paid line is a negative
-- allocation on the old line plus an equal positive allocation on the
-- replacement line against the same historical payout event — no row is
-- ever edited or deleted.
-- ---------------------------------------------------------------------------

create table public.settlement_line_payouts (
  id uuid primary key default gen_random_uuid(),
  settlement_line_id uuid not null references public.settlement_lines(id),
  payout_cash_event_id uuid not null references public.cash_events(id),
  -- Signed allocation: positive pays the line, negative transfers/corrects a
  -- prior allocation away from it.
  amount_centavos bigint not null check (amount_centavos <> 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  created_by_member_id uuid not null references public.members(id),
  idempotency_key text not null unique
);

alter table public.settlement_line_payouts enable row level security;

create policy settlement_line_payouts_select_founder on public.settlement_line_payouts
  for select
  using (
    public.is_active_founder(public.org_id_for_settlement(
      (select settlement_id from public.settlement_lines sl where sl.id = settlement_line_id)
    ))
  );

create policy settlement_line_payouts_select_own on public.settlement_line_payouts
  for select
  using (
    (select member_id from public.settlement_lines sl where sl.id = settlement_line_id) = public.current_member_id()
  );

-- No INSERT policy: the only write door is record_payout(), added once the
-- audited finance RPCs ship (P3).

-- An allocation may only target a line of an approved *original* settlement
-- (never a reversal or a pending settlement), and its currency must agree
-- with both the line and the payout cash event it draws from.
create or replace function public.guard_settlement_line_payout_insert()
returns trigger
language plpgsql
as $$
declare
  line public.settlement_lines;
  settlement public.settlements;
  event public.cash_events;
begin
  select * into line from public.settlement_lines where id = new.settlement_line_id;
  if line is null then
    raise exception 'settlement_line_payout % references a nonexistent settlement line', new.id;
  end if;

  select * into settlement from public.settlements where id = line.settlement_id;
  if settlement.status <> 'approved' or settlement.kind <> 'original' then
    raise exception 'settlement_line_payout % must target a line of an approved original settlement', new.id;
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

create trigger settlement_line_payouts_guard_insert
  before insert on public.settlement_line_payouts
  for each row execute function public.guard_settlement_line_payout_insert();

create trigger settlement_line_payouts_immutable
  before update or delete on public.settlement_line_payouts
  for each row execute function public.forbid_mutation();

-- Invariant: a line's allocations never fall outside 0..line.amount_centavos
-- at commit — no overpayment, no negative-total payout.
create or replace function public.check_settlement_line_payout_within_line()
returns trigger
language plpgsql
as $$
declare
  affected_line_id uuid;
  line_amount bigint;
  allocated bigint;
begin
  affected_line_id := coalesce(new.settlement_line_id, old.settlement_line_id);
  select amount_centavos into line_amount from public.settlement_lines where id = affected_line_id;
  select coalesce(sum(amount_centavos), 0) into allocated
  from public.settlement_line_payouts
  where settlement_line_id = affected_line_id;

  if allocated < 0 or allocated > line_amount then
    raise exception
      'settlement line % payout allocations total % but must fall within 0..%',
      affected_line_id, allocated, line_amount;
  end if;
  return null;
end;
$$;

create constraint trigger settlement_line_payouts_within_line
  after insert on public.settlement_line_payouts
  deferrable initially deferred
  for each row execute function public.check_settlement_line_payout_within_line();

-- Invariant: a payout cash event's allocations always exactly reconcile its
-- outflow, since payout cash events are negative (Invariant in section 4.1).
create or replace function public.check_settlement_line_payout_matches_event()
returns trigger
language plpgsql
as $$
declare
  affected_event_id uuid;
  event_amount bigint;
  allocated bigint;
begin
  affected_event_id := coalesce(new.payout_cash_event_id, old.payout_cash_event_id);
  select amount_centavos into event_amount from public.cash_events where id = affected_event_id;
  select coalesce(sum(amount_centavos), 0) into allocated
  from public.settlement_line_payouts
  where payout_cash_event_id = affected_event_id;

  if allocated <> -event_amount then
    raise exception
      'payout cash event % allocations total % but must equal %',
      affected_event_id, allocated, -event_amount;
  end if;
  return null;
end;
$$;

create constraint trigger settlement_line_payouts_matches_event
  after insert on public.settlement_line_payouts
  deferrable initially deferred
  for each row execute function public.check_settlement_line_payout_matches_event();

-- Invariant: a payout cash event must reconcile at commit even when it has
-- received ZERO allocation rows. check_settlement_line_payout_matches_event
-- above only ever fires when a settlement_line_payouts row is inserted
-- against a given event — an "orphan" payout event that nobody ever
-- allocated against would otherwise pass silently. This trigger lives on
-- cash_events itself so a payout row with zero allocations is still caught.
create or replace function public.check_payout_cash_event_reconciles()
returns trigger
language plpgsql
as $$
declare
  affected public.cash_events;
  allocated bigint;
begin
  affected := new;
  if affected.type <> 'payout' then
    return null;
  end if;

  select coalesce(sum(amount_centavos), 0) into allocated
  from public.settlement_line_payouts
  where payout_cash_event_id = affected.id;

  if allocated <> -affected.amount_centavos then
    raise exception
      'payout cash event % allocations total % but must equal %',
      affected.id, allocated, -affected.amount_centavos;
  end if;
  return null;
end;
$$;

create constraint trigger cash_events_payout_reconciles
  after insert or update on public.cash_events
  deferrable initially deferred
  for each row execute function public.check_payout_cash_event_reconciles();

-- ---------------------------------------------------------------------------
-- stat_events — append-only, system/founder-derived, never client-editable.
--
-- Read visibility is org-wide (any active member), not founder-only: profile
-- and leaderboard pages show performance stats to every viewer per
-- docs/M1-HANDOFF.md's route table. What stays founder-only is WRITE access —
-- "No member may edit financial or performance stats directly"
-- (docs/PRODUCT-BRIEF.md) — enforced by the insert policy plus the
-- immutability trigger below.
-- ---------------------------------------------------------------------------

-- Signed and source-idempotent: an original row's (source_kind, source_id)
-- identifies exactly one real-world fact, so a retried write cannot inflate
-- history, and a mistake is corrected by appending a reversal that carries
-- the exact negative quantity rather than by editing or deleting the row.
create table public.stat_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  opportunity_id uuid not null references public.opportunities(id),
  metric_key text not null check (
    metric_key in (
      'opportunity_closed', 'delivery_completed', 'delivered_on_time',
      'delivered_late', 'revision_requested', 'accepted_first_pass'
    )
  ),
  quantity integer not null,
  source_kind text not null,
  source_id uuid not null,
  reverses_stat_event_id uuid references public.stat_events(id),
  occurred_at timestamptz not null default now(),
  -- A zero-quantity original is a no-op fact, not a real event; only a
  -- reversal may legitimately need to reference a quantity that could
  -- otherwise look degenerate (it never does, since it must be the exact
  -- negative of a nonzero original, but the constraint is scoped to
  -- originals only for clarity).
  constraint stat_events_original_quantity_nonzero check (
    reverses_stat_event_id is not null or quantity <> 0
  )
);

-- An original fact's source identity is unique; a reversal legitimately
-- repeats its original's (source_kind, source_id), so uniqueness is scoped
-- to rows that are not themselves reversals.
create unique index stat_events_unique_original_source
  on public.stat_events (source_kind, source_id)
  where reverses_stat_event_id is null;

-- One original can be reversed at most once.
create unique index stat_events_one_reversal_per_original
  on public.stat_events (reverses_stat_event_id)
  where reverses_stat_event_id is not null;

alter table public.stat_events enable row level security;

create policy stat_events_select_org on public.stat_events
  for select
  using (
    public.is_active_member((select org_id from public.members m where m.id = member_id))
  );

-- No INSERT policy: stat_events has no browser write path at all until its
-- own audited canonical RPC ships (mirroring the finance tables' P1 write
-- doctrine). A direct founder-insert policy here would let performance
-- history be written without the audit trail and idempotency guarantees a
-- real RPC provides.

-- A reversal must exactly negate the original it names: same member,
-- opportunity, metric, and source, and the exact negative quantity.
create or replace function public.guard_stat_event_reversal()
returns trigger
language plpgsql
as $$
declare
  original public.stat_events;
begin
  if new.reverses_stat_event_id is null then
    return new;
  end if;

  select * into original from public.stat_events where id = new.reverses_stat_event_id;
  if original is null then
    raise exception 'stat_event % reverses a nonexistent stat_event %', new.id, new.reverses_stat_event_id;
  end if;
  if original.reverses_stat_event_id is not null then
    raise exception 'stat_event % may only reverse an original stat event', new.id;
  end if;
  if original.member_id <> new.member_id
    or original.opportunity_id <> new.opportunity_id
    or original.metric_key <> new.metric_key
    or original.source_kind <> new.source_kind
    or original.source_id <> new.source_id
  then
    raise exception 'stat_event % must match its original''s member, opportunity, metric, and source', new.id;
  end if;
  if new.quantity <> -original.quantity then
    raise exception 'stat_event % must carry the exact negative of its original''s quantity', new.id;
  end if;
  return new;
end;
$$;

create trigger stat_events_guard_reversal
  before insert on public.stat_events
  for each row execute function public.guard_stat_event_reversal();

create trigger stat_events_immutable
  before update or delete on public.stat_events
  for each row execute function public.forbid_mutation();

-- The member- and leaderboard-facing aggregate. security_invoker = true is
-- essential here: it makes the view re-check RLS as the querying user on
-- every call, using the org-wide select policy above. Without it, a view
-- created by a superuser-ish migration role would run with that role's
-- privileges and bypass RLS entirely — leaking every org's counts to anyone
-- granted select on the view. Do not remove security_invoker when editing.
create view public.member_stats
with (security_invoker = true)
as
select
  member_id,
  coalesce(sum(quantity) filter (where metric_key = 'opportunity_closed'), 0) as closed,
  coalesce(sum(quantity) filter (where metric_key = 'delivery_completed'), 0) as delivered,
  coalesce(sum(quantity) filter (where metric_key = 'delivered_on_time'), 0) as on_time,
  coalesce(sum(quantity) filter (where metric_key = 'delivered_late'), 0) as late,
  coalesce(sum(quantity) filter (where metric_key = 'revision_requested'), 0) as revisions_requested,
  coalesce(sum(quantity) filter (where metric_key = 'accepted_first_pass'), 0) as accepted_first_pass
from public.stat_events
group by member_id;

grant select on public.member_stats to authenticated;
