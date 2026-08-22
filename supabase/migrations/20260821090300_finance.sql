-- FIRMA23 Ops — M2 foundation, part 4: cash events, settlements, settlement
-- lines, and stat events.
--
-- This is the most safety-critical file in the set. Every invariant in
-- docs/ARCHITECTURE.md's "Required invariants" list that mentions money is
-- enforced here at the database layer, not only in the TypeScript allocation
-- engine (src/lib/allocation.ts) that already enforces it for the read path.

create table public.cash_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  type text not null check (type in ('invoice', 'withholding', 'deposit', 'contribution', 'adjustment', 'payout')),
  label text not null,
  amount_centavos bigint not null,
  currency text not null default 'MXN' check (currency = 'MXN'),
  occurred_at date not null,
  created_at timestamptz not null default now()
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

create policy cash_events_founder_insert on public.cash_events
  for insert
  with check (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)));

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
  base_centavos bigint not null check (base_centavos >= 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  approved_at timestamptz,
  approved_by_member_id uuid references public.members(id),
  created_at timestamptz not null default now(),
  constraint settlements_approval_fields_together check (
    (status = 'approved' and approved_at is not null and approved_by_member_id is not null)
    or (status = 'pending' and approved_at is null and approved_by_member_id is null)
  )
);

-- At most one approved settlement per opportunity. Multiple pending drafts
-- are allowed (a founder previewing again does not collide), which is why
-- this is a partial unique index rather than a plain table-level unique.
create unique index settlements_one_approved_per_opportunity
  on public.settlements (opportunity_id)
  where status = 'approved';

alter table public.settlements enable row level security;

create policy settlements_select_founder on public.settlements
  for select
  using (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)));

-- A settlement may only be created in 'pending' state through ordinary
-- writes; moving it to 'approved' is reserved for the approve_settlement
-- function (added once the write path ships in a later phase) so that
-- "approved" always carries a real founder identity resolved from auth.uid(),
-- never a value copied from client input.
create policy settlements_founder_insert_pending on public.settlements
  for insert
  with check (
    status = 'pending'
    and public.is_active_founder(public.org_id_for_opportunity(opportunity_id))
  );

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

create table public.settlement_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  share_key text not null,
  recipient_kind text not null check (recipient_kind in ('house', 'closer', 'delivery_pool')),
  recipient_label text not null,
  member_id uuid references public.members(id),
  role_label text not null,
  weight_bp integer not null check (weight_bp >= 0 and weight_bp <= 10000),
  amount_centavos bigint not null,
  currency text not null default 'MXN' check (currency = 'MXN'),
  payout_status text not null check (payout_status in ('unpaid', 'paid')),
  paid_at timestamptz,
  payout_cash_event_id uuid references public.cash_events(id),
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

alter table public.settlement_lines enable row level security;

create policy settlement_lines_select_founder on public.settlement_lines
  for select
  using (public.is_active_founder(public.org_id_for_settlement(settlement_id)));

-- Invariant: "Read their own settlement lines" (docs/ARCHITECTURE.md, Member).
create policy settlement_lines_select_own on public.settlement_lines
  for select
  using (member_id = public.current_member_id());

-- Lines may only be inserted against an already-approved settlement — a
-- pending settlement carries zero lines, matching the fixture invariant
-- tested in tests/data/fixtures.test.ts ("has pending settlements carrying no
-- lines at all"). This also means direct client inserts are pointless in
-- practice; real writes go through approve_settlement in a later migration,
-- which runs as the table owner and is exempt from this policy's USING
-- clause because SECURITY DEFINER functions bypass RLS on the tables they
-- touch unless the function itself is written to respect it.
create policy settlement_lines_founder_insert_when_approved on public.settlement_lines
  for insert
  with check (
    exists (select 1 from public.settlements s where s.id = settlement_id and s.status = 'approved')
    and public.is_active_founder(public.org_id_for_settlement(settlement_id))
  );

create trigger settlement_lines_immutable
  before update or delete on public.settlement_lines
  for each row execute function public.forbid_mutation();

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
-- stat_events — append-only, system/founder-derived, never client-editable.
--
-- Read visibility is org-wide (any active member), not founder-only: profile
-- and leaderboard pages show performance stats to every viewer per
-- docs/M1-HANDOFF.md's route table. What stays founder-only is WRITE access —
-- "No member may edit financial or performance stats directly"
-- (docs/PRODUCT-BRIEF.md) — enforced by the insert policy plus the
-- immutability trigger below.
-- ---------------------------------------------------------------------------

create table public.stat_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  opportunity_id uuid not null references public.opportunities(id),
  type text not null check (
    type in (
      'opportunity_closed', 'delivery_completed', 'delivered_on_time',
      'delivered_late', 'revision_requested', 'accepted_first_pass'
    )
  ),
  occurred_at timestamptz not null default now()
);

alter table public.stat_events enable row level security;

create policy stat_events_select_org on public.stat_events
  for select
  using (
    public.is_active_member((select org_id from public.members m where m.id = member_id))
  );

create policy stat_events_founder_insert on public.stat_events
  for insert
  with check (
    public.is_active_founder((select org_id from public.members m where m.id = member_id))
  );

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
  count(*) filter (where type = 'opportunity_closed') as closed,
  count(*) filter (where type = 'delivery_completed') as delivered,
  count(*) filter (where type = 'delivered_on_time') as on_time,
  count(*) filter (where type = 'delivered_late') as late,
  count(*) filter (where type = 'revision_requested') as revisions_requested,
  count(*) filter (where type = 'accepted_first_pass') as accepted_first_pass
from public.stat_events
group by member_id;

grant select on public.member_stats to authenticated;
