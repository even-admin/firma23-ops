-- FIRMA23 Ops — M2 foundation, part 6: invite-only auth wiring and private
-- document storage.
--
-- Supabase Auth (magic link / OTP) can authenticate anyone with an email
-- address; nothing about auth.users itself is invite-only. This file is what
-- actually makes the product invite-only: signing in grants zero access
-- unless a founder created a matching member_invites row first, and every
-- table's RLS above already requires an *active* membership, not merely an
-- authenticated session.

create table public.member_invites (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) unique,
  -- Not joined against public.members; email lives in auth.users. This
  -- table exists only to reconcile a not-yet-authenticated invite to the
  -- member row a founder already created for them.
  email text not null unique,
  invited_at timestamptz not null default now(),
  redeemed_at timestamptz
);

alter table public.member_invites enable row level security;

create policy member_invites_select_founder on public.member_invites
  for select
  using (
    public.is_active_founder((select org_id from public.members m where m.id = member_id))
  );

create policy member_invites_founder_insert on public.member_invites
  for insert
  with check (
    public.is_active_founder((select org_id from public.members m where m.id = member_id))
  );

-- Runs as the function owner against the auth schema, which an ordinary
-- authenticated role cannot touch directly. This is the one place a member
-- row's auth_user_id or a membership's status is ever set by anything other
-- than a founder-driven RPC — and it only ever activates an invite that
-- already names that exact email, never creates new access out of thin air.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.member_invites;
begin
  select * into invite from public.member_invites
  where email = new.email and redeemed_at is null;

  if invite is null then
    -- No matching invite: the account exists in Supabase Auth but is linked
    -- to no member, so every RLS policy in this schema denies it by
    -- construction. This is intentional, not a bug to fix by widening access.
    return new;
  end if;

  update public.members set auth_user_id = new.id where id = invite.member_id;

  update public.memberships
  set status = 'active', activated_at = now()
  where member_id = invite.member_id and status = 'invited';

  update public.member_invites set redeemed_at = now() where id = invite.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Private document storage.
--
-- Founders can prepare a contract by dropping a proposal/report/deck/quote/
-- SOW. Storage keys are namespaced `${org_id}/${uuid}-${filename}` so the
-- policy below can scope access without a second lookup table.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('source-documents', 'source-documents', false)
on conflict (id) do nothing;

create policy source_documents_storage_founder_read
  on storage.objects for select
  using (
    bucket_id = 'source-documents'
    and public.is_active_founder(((string_to_array(name, '/'))[1])::uuid)
  );

create policy source_documents_storage_founder_write
  on storage.objects for insert
  with check (
    bucket_id = 'source-documents'
    and public.is_active_founder(((string_to_array(name, '/'))[1])::uuid)
  );

-- Uploaded documents are evidence for an eventual contract; they are not
-- edited or deleted through the app once uploaded. Deletion, if ever needed,
-- is an explicit founder/ops action outside this MVP, not a policy to design
-- around here.
