-- FIRMA23 Ops — M2 foundation, part 3: opportunities, assignments, execution
-- milestones, and evidence.
--
-- Visibility here is intentionally narrower for members than for founders:
-- a member sees an opportunity only if assigned to it. Full opportunity
-- detail (financial rail, ledger) stays founder-only, matching
-- syntheticOpportunityRepository's assertFounder in the M1 read layer.
--
-- Every CREATE TABLE in this file comes before any RLS policy, including
-- policies that live on an earlier table but reference a later one. A
-- policy's USING/WITH CHECK expression is resolved at CREATE POLICY time,
-- the same as a CHECK constraint, so the referenced table must already
-- exist.
--
-- Cross-table lookups inside a policy go through a SECURITY DEFINER
-- function (org_id_for_opportunity, is_assigned_to_opportunity, etc.),
-- never an inline join. This was not a style choice: opportunities' member-
-- visibility policy needs to query assignments, and assignments' founder
-- policy needs to query opportunities, and writing that as two plain inline
-- joins deadlocks Postgres's own RLS evaluator — "infinite recursion
-- detected in policy for relation opportunities" on every single query, even
-- `select count(*) from opportunities` with no join at all. Verified locally
-- against a throwaway Postgres 17 instance before and after this fix; see
-- the session's verification notes. A SECURITY DEFINER function owned by
-- the table owner bypasses RLS on the tables it queries internally, so the
-- lookup never re-enters the calling table's own policy.

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  service_version_id uuid not null references public.service_versions(id),
  allocation_rule_version_id uuid not null references public.allocation_rule_versions(id),
  code text not null unique,
  beneficiary_name text not null,
  beneficiary_location text not null,
  status text not null check (
    status in ('draft', 'assigned', 'in_delivery', 'delivered', 'settled_approved', 'paid', 'cancelled')
  ),
  opened_at date not null,
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  member_id uuid not null references public.members(id),
  role_key text not null check (role_key in ('closer', 'delivery')),
  role_label text not null,
  weight_bp integer not null check (weight_bp >= 0 and weight_bp <= 10000),
  status text not null check (status in ('proposed', 'approved')),
  unique (opportunity_id, member_id, role_key)
);

create table public.opportunity_milestones (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  template_id uuid not null references public.milestone_templates(id),
  position integer not null check (position > 0),
  name text not null,
  status text not null check (status in ('pending', 'in_progress', 'done', 'blocked')),
  due_at date,
  completed_at date,
  assigned_member_id uuid references public.members(id),
  unique (opportunity_id, template_id)
);

create table public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  opportunity_milestone_id uuid not null references public.opportunity_milestones(id) on delete cascade,
  label text not null,
  url text not null,
  kind text not null check (kind in ('link', 'image', 'video', 'document')),
  submitted_by_member_id uuid not null references public.members(id),
  submitted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cross-table RLS lookup functions. See the file header for why these exist
-- instead of inline joins.
-- ---------------------------------------------------------------------------

create or replace function public.org_id_for_opportunity(p_opportunity_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.org_id
  from public.projects p
  join public.opportunities o on o.project_id = p.id
  where o.id = p_opportunity_id;
$$;

create or replace function public.is_assigned_to_opportunity(p_opportunity_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.assignments a
    where a.opportunity_id = p_opportunity_id
      and a.member_id = public.current_member_id()
  );
$$;

create or replace function public.org_id_for_milestone(p_milestone_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select public.org_id_for_opportunity(om.opportunity_id)
  from public.opportunity_milestones om
  where om.id = p_milestone_id;
$$;

create or replace function public.is_assigned_to_milestone_opportunity(p_milestone_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.opportunity_milestones om
    where om.id = p_milestone_id
      and public.is_assigned_to_opportunity(om.opportunity_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: opportunities
-- ---------------------------------------------------------------------------

alter table public.opportunities enable row level security;

create policy opportunities_select_founder on public.opportunities
  for select
  using (public.is_active_founder((select org_id from public.projects p where p.id = project_id)));

create policy opportunities_select_assigned_member on public.opportunities
  for select
  using (public.is_assigned_to_opportunity(id));

create policy opportunities_founder_write on public.opportunities
  for all
  using (public.is_active_founder((select org_id from public.projects p where p.id = project_id)))
  with check (public.is_active_founder((select org_id from public.projects p where p.id = project_id)));

-- ---------------------------------------------------------------------------
-- RLS: assignments
-- ---------------------------------------------------------------------------

alter table public.assignments enable row level security;

create policy assignments_select_founder on public.assignments
  for select
  using (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)));

create policy assignments_select_self on public.assignments
  for select
  using (member_id = public.current_member_id());

-- Assignment is founder-controlled in MVP; see docs/ARCHITECTURE.md
-- "Matching boundary" and docs/PRODUCT-BRIEF.md core loop step 5. A member
-- may read their own assignment row but never write it.
create policy assignments_founder_write on public.assignments
  for all
  using (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)))
  with check (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)));

-- ---------------------------------------------------------------------------
-- RLS: opportunity_milestones
-- ---------------------------------------------------------------------------

alter table public.opportunity_milestones enable row level security;

create policy opportunity_milestones_select_founder on public.opportunity_milestones
  for select
  using (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)));

create policy opportunity_milestones_select_assigned on public.opportunity_milestones
  for select
  using (
    assigned_member_id = public.current_member_id()
    or public.is_assigned_to_opportunity(opportunity_id)
  );

create policy opportunity_milestones_founder_write on public.opportunity_milestones
  for all
  using (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)))
  with check (public.is_active_founder(public.org_id_for_opportunity(opportunity_id)));

-- The assigned member updates their own milestone's status/evidence. RLS
-- alone cannot compare old vs. new column values, so a trigger below blocks
-- them from reassigning it, changing its due date, or touching another
-- milestone; this policy only admits the row in the first place.
create policy opportunity_milestones_assignee_update_status on public.opportunity_milestones
  for update
  using (assigned_member_id = public.current_member_id())
  with check (assigned_member_id = public.current_member_id());

create or replace function public.guard_milestone_assignee_update()
returns trigger
language plpgsql
as $$
begin
  -- Founders may change anything; this guard only constrains the assignee path.
  if public.is_active_founder(public.org_id_for_opportunity(new.opportunity_id)) then
    return new;
  end if;

  if new.opportunity_id is distinct from old.opportunity_id
    or new.template_id is distinct from old.template_id
    or new.position is distinct from old.position
    or new.due_at is distinct from old.due_at
    or new.assigned_member_id is distinct from old.assigned_member_id
  then
    raise exception 'an assignee may only update a milestone''s status and completion date';
  end if;
  return new;
end;
$$;

create trigger opportunity_milestones_guard_assignee_update
  before update on public.opportunity_milestones
  for each row execute function public.guard_milestone_assignee_update();

-- ---------------------------------------------------------------------------
-- RLS: evidence_links
-- ---------------------------------------------------------------------------

alter table public.evidence_links enable row level security;

create policy evidence_links_select_founder on public.evidence_links
  for select
  using (public.is_active_founder(public.org_id_for_milestone(opportunity_milestone_id)));

create policy evidence_links_select_assigned on public.evidence_links
  for select
  using (public.is_assigned_to_milestone_opportunity(opportunity_milestone_id));

-- Evidence is append-only submission by the assigned member, never a
-- founder-authored row and never editable after submission.
create policy evidence_links_insert_assignee on public.evidence_links
  for insert
  with check (
    submitted_by_member_id = public.current_member_id()
    and exists (
      select 1 from public.opportunity_milestones om
      where om.id = opportunity_milestone_id
        and om.assigned_member_id = public.current_member_id()
    )
  );

create trigger evidence_links_immutable
  before update or delete on public.evidence_links
  for each row execute function public.forbid_mutation();
