-- FIRMA23 Ops — M2 foundation, part 2: projects (founder-facing "contracts"),
-- service versions, milestone templates, and allocation rule versions.
--
-- Service versions and allocation rule versions are immutable once created —
-- Invariant 3 in docs/ARCHITECTURE.md. That is enforced here with a trigger,
-- not just the `immutable boolean` column the fixtures already carry.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  slug text not null unique,
  name text not null,
  sponsor_name text not null,
  status text not null check (status in ('draft', 'active', 'closed')),
  -- ISO 4217 alpha code, not a platform constant: FIRMA23 is project-agnostic
  -- even though every fixture and confirmed contract today is MXN.
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  -- FK to allocation_rule_versions is added at the end of this file, once
  -- that table exists. Circular reference between the two tables is expected.
  active_allocation_rule_version_id uuid,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy projects_select_org on public.projects
  for select
  using (public.is_active_member(org_id));

-- Founders create/edit projects directly for manual entry; document-first
-- creation goes through confirm_contract_draft (next migration) instead, so
-- an AI draft can never insert a project on its own.
create policy projects_founder_write on public.projects
  for all
  using (public.is_active_founder(org_id))
  with check (public.is_active_founder(org_id));

create table public.service_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  key text not null,
  name text not null,
  version integer not null check (version > 0),
  deliverables_summary text not null,
  immutable boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, key, version)
);

alter table public.service_versions enable row level security;

create policy service_versions_select_org on public.service_versions
  for select
  using (public.is_active_member((select org_id from public.projects p where p.id = project_id)));

create policy service_versions_founder_insert on public.service_versions
  for insert
  with check (public.is_active_founder((select org_id from public.projects p where p.id = project_id)));

create trigger service_versions_immutable
  before update or delete on public.service_versions
  for each row execute function public.forbid_mutation();

create table public.milestone_templates (
  id uuid primary key default gen_random_uuid(),
  service_version_id uuid not null references public.service_versions(id),
  position integer not null check (position > 0),
  name text not null,
  description text not null,
  unique (service_version_id, position)
);

alter table public.milestone_templates enable row level security;

create policy milestone_templates_select_org on public.milestone_templates
  for select
  using (
    public.is_active_member((
      select p.org_id from public.projects p
      join public.service_versions sv on sv.project_id = p.id
      where sv.id = service_version_id
    ))
  );

create policy milestone_templates_founder_insert on public.milestone_templates
  for insert
  with check (
    public.is_active_founder((
      select p.org_id from public.projects p
      join public.service_versions sv on sv.project_id = p.id
      where sv.id = service_version_id
    ))
  );

create trigger milestone_templates_immutable
  before update or delete on public.milestone_templates
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- allocation_rule_versions + allocation_shares
--
-- Shares are their own table, not a jsonb array, specifically so the database
-- can enforce Invariant 6 (a rule's shares total exactly 10,000 basis points)
-- with a constraint trigger rather than trusting every writer to add correctly.
-- ---------------------------------------------------------------------------

create table public.allocation_rule_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  version integer not null check (version > 0),
  effective_from date not null,
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  immutable boolean not null default true,
  base_policy jsonb not null check (
    base_policy ? 'kind' and base_policy ? 'includeTypes' and base_policy ? 'label' and base_policy ? 'note'
  ),
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

alter table public.allocation_rule_versions enable row level security;

create policy allocation_rule_versions_select_org on public.allocation_rule_versions
  for select
  using (public.is_active_member((select org_id from public.projects p where p.id = project_id)));

create policy allocation_rule_versions_founder_insert on public.allocation_rule_versions
  for insert
  with check (public.is_active_founder((select org_id from public.projects p where p.id = project_id)));

create trigger allocation_rule_versions_immutable
  before update or delete on public.allocation_rule_versions
  for each row execute function public.forbid_mutation();

alter table public.projects
  add constraint projects_active_rule_fk
  foreign key (active_allocation_rule_version_id)
  references public.allocation_rule_versions(id);

create table public.allocation_shares (
  id uuid primary key default gen_random_uuid(),
  rule_version_id uuid not null references public.allocation_rule_versions(id) on delete cascade,
  key text not null,
  -- org_recipient: paid to the org itself (formerly 'house'), no member split.
  -- member_pool: split across the assignments whose role_key equals this
  -- share's key (formerly 'closer'/'delivery_pool' as two fixed kinds) — the
  -- project-defined key is now what distinguishes pools from one another,
  -- not a hardcoded enum value.
  recipient_behavior text not null check (recipient_behavior in ('org_recipient', 'member_pool')),
  label text not null,
  weight_bp integer not null check (weight_bp >= 0 and weight_bp <= 10000),
  recipient_org_id uuid references public.organizations(id),
  unique (rule_version_id, key)
);

alter table public.allocation_shares enable row level security;

create policy allocation_shares_select_org on public.allocation_shares
  for select
  using (
    public.is_active_member((
      select p.org_id from public.projects p
      join public.allocation_rule_versions arv on arv.project_id = p.id
      where arv.id = rule_version_id
    ))
  );

create policy allocation_shares_founder_insert on public.allocation_shares
  for insert
  with check (
    public.is_active_founder((
      select p.org_id from public.projects p
      join public.allocation_rule_versions arv on arv.project_id = p.id
      where arv.id = rule_version_id
    ))
  );

create trigger allocation_shares_immutable
  before update or delete on public.allocation_shares
  for each row execute function public.forbid_mutation();

-- Invariant 6: a rule version's shares must total exactly 10,000 basis
-- points. Deferred so a multi-row INSERT within one transaction is allowed to
-- pass through zero mid-transaction and only has to balance by COMMIT.
create or replace function public.check_allocation_shares_total()
returns trigger
language plpgsql
as $$
declare
  affected_rule_version_id uuid;
  total integer;
begin
  affected_rule_version_id := coalesce(new.rule_version_id, old.rule_version_id);
  select coalesce(sum(weight_bp), 0) into total
  from public.allocation_shares
  where rule_version_id = affected_rule_version_id;

  if total <> 10000 then
    raise exception
      'allocation_rule_versions % shares total % basis points, expected 10000',
      affected_rule_version_id, total;
  end if;
  return null;
end;
$$;

create constraint trigger allocation_shares_total_balanced
  after insert on public.allocation_shares
  deferrable initially deferred
  for each row execute function public.check_allocation_shares_total();
