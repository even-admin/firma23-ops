-- FIRMA23 Ops — M2 foundation, part 1: organizations, invite-only membership,
-- member identity, and the skills/portfolio catalog.
--
-- This is additive-only and has never been applied. It is reviewed and staged
-- for the verified development project agsfxtbgwlkcwfyrykfo; do not point it at
-- any other project. Every table mirrors a type in src/types/domain.ts or a
-- view built from those types, so the Supabase adapters under
-- src/data/repositories/supabase/** can map rows one to one.
--
-- Naming note: the product calls the top-level commercial unit a "contract" in
-- founder-facing copy and in docs/WEEKEND-EXECUTION.md's table list. This
-- schema keeps the table name `projects` because that is what
-- docs/ARCHITECTURE.md specifies and what the existing `Project` domain type,
-- fixtures, and every M1 route already use. Renaming the table would not
-- rename the product concept; "contract" and "project" refer to the same row.

create extension if not exists pgcrypto;

-- Generic guard used on every append-only ledger table. Corrections append a
-- reversal or adjustment row; they never rewrite history. Invariant 7.
-- plpgsql, not sql, and references no table, so it is safe to define before
-- any table exists.
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only: % is not permitted', tg_table_name, tg_op;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- members — identity is a stable UUID, never a display name. See
-- docs/PRODUCT-BRIEF.md: "Identity is a stable UUID and email, never a
-- display name." auth_user_id is nullable until the person's Supabase Auth
-- account is linked (invite-only signup, wired in the next migration).
-- ---------------------------------------------------------------------------

create table public.members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  slug text not null unique,
  display_name text not null,
  initials text not null check (char_length(initials) between 1 and 4),
  role text not null check (role in ('founder', 'member')),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Lets memberships carry a composite FK below, so a membership row's org_id
  -- can never disagree with the org_id already stamped on the member it
  -- references. Without this, a corrupt or forged membership insert could
  -- smuggle founder authority into an org the member does not actually
  -- belong to.
  unique (id, org_id)
);

-- ---------------------------------------------------------------------------
-- memberships — invitation and active status. Supabase Auth handles
-- credentials; this table is the invite-only gate. A person with no row here,
-- or a row whose status is not 'active', has no authorization regardless of
-- whether they can authenticate.
-- ---------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  member_id uuid not null references public.members(id),
  status text not null check (status in ('invited', 'active', 'revoked')),
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (org_id, member_id),
  -- Composite FK against members(id, org_id): a membership can only ever
  -- name the org its member actually belongs to.
  foreign key (member_id, org_id) references public.members(id, org_id)
);

-- ---------------------------------------------------------------------------
-- RLS helper functions. These must come after organizations/members/
-- memberships exist: LANGUAGE sql functions are parsed and their table
-- references resolved at CREATE FUNCTION time (unlike plpgsql, which only
-- checks syntax up front), so defining these earlier fails immediately.
-- ---------------------------------------------------------------------------

create or replace function public.current_member_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.members where auth_user_id = auth.uid();
$$;

create or replace function public.is_active_founder(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    join public.memberships ms on ms.member_id = m.id
    where m.auth_user_id = auth.uid()
      and m.role = 'founder'
      and ms.org_id = target_org_id
      and ms.status = 'active'
  );
$$;

create or replace function public.is_active_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    join public.memberships ms on ms.member_id = m.id
    where m.auth_user_id = auth.uid()
      and ms.org_id = target_org_id
      and ms.status = 'active'
  );
$$;

-- Every RLS policy in this schema calls one of these three functions, so any
-- authenticated query needs EXECUTE on them; PUBLIC (which otherwise defaults
-- to including anon) does not.
revoke execute on function public.current_member_id() from public;
revoke execute on function public.is_active_founder(uuid) from public;
revoke execute on function public.is_active_member(uuid) from public;
grant execute on function public.current_member_id() to authenticated;
grant execute on function public.is_active_founder(uuid) to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies for organizations, members, and memberships, now that the
-- helper functions they call all exist.
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;

create policy organizations_select_member on public.organizations
  for select
  using (public.is_active_member(id));

alter table public.members enable row level security;

create policy members_select_org on public.members
  for select
  using (public.is_active_member(org_id));

alter table public.memberships enable row level security;

create policy memberships_select_self_or_founder on public.memberships
  for select
  using (
    member_id = public.current_member_id()
    or public.is_active_founder(org_id)
  );

-- ---------------------------------------------------------------------------
-- member_profiles, skills, member_skills, portfolio_items — the operator
-- network catalog. Readable by any active org member; a member may only ever
-- write their own profile/skills/portfolio rows, never another member's, and
-- never a stat or earnings figure (those live in stat_events and
-- settlement_lines, both append-only and founder/system-written only).
-- ---------------------------------------------------------------------------

create table public.member_profiles (
  member_id uuid primary key references public.members(id),
  bio text not null default '',
  availability text not null check (availability in ('open', 'limited', 'unavailable')),
  next_capability text not null default '',
  joined_at date not null default current_date
);

alter table public.member_profiles enable row level security;

create policy member_profiles_select_org on public.member_profiles
  for select
  using (
    public.is_active_member((select org_id from public.members m where m.id = member_id))
  );

create policy member_profiles_write_self on public.member_profiles
  for update
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

create policy member_profiles_insert_self on public.member_profiles
  for insert
  with check (member_id = public.current_member_id());

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  family text not null
);

alter table public.skills enable row level security;

create policy skills_select_authenticated on public.skills
  for select
  using (auth.uid() is not null);

create table public.member_skills (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  skill_id uuid not null references public.skills(id),
  level text not null check (level in ('learning', 'working', 'strong', 'lead')),
  verification text not null check (verification in ('self_reported', 'verified')),
  unique (member_id, skill_id)
);

alter table public.member_skills enable row level security;

create policy member_skills_select_org on public.member_skills
  for select
  using (
    public.is_active_member((select org_id from public.members m where m.id = member_id))
  );

create policy member_skills_write_self on public.member_skills
  for all
  using (member_id = public.current_member_id())
  with check (
    member_id = public.current_member_id()
    -- A member may self-report a skill but never mark it verified.
    -- Verification is a founder action; enforced again below.
    and verification = 'self_reported'
  );

create policy member_skills_founder_verify on public.member_skills
  for update
  using (public.is_active_founder((select org_id from public.members m where m.id = member_id)))
  with check (public.is_active_founder((select org_id from public.members m where m.id = member_id)));

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  title text not null,
  role_label text not null,
  url text not null,
  kind text not null check (kind in ('link', 'image', 'video', 'document')),
  verification text not null check (verification in ('self_reported', 'verified')),
  completed_at date not null
);

alter table public.portfolio_items enable row level security;

create policy portfolio_items_select_org on public.portfolio_items
  for select
  using (
    public.is_active_member((select org_id from public.members m where m.id = member_id))
  );

create policy portfolio_items_write_self on public.portfolio_items
  for all
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id() and verification = 'self_reported');
