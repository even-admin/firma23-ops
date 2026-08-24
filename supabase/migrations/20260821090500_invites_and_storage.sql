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
  expires_at timestamptz not null default (now() + interval '14 days'),
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

-- redeem_invite — the post-login invite-redemption boundary.
--
-- Replaces an auth.users insert trigger: a trigger that fails partway
-- through membership logic would block creation of every Supabase Auth user,
-- not just invited ones. This RPC is called by the app right after login
-- instead, so a bug or exception here can never block unrelated signup. It
-- resolves email from the authenticated session, never from client input,
-- and is safe to call repeatedly — a second call after redemption, or a call
-- from an account with no invite at all, returns a state instead of raising.
create or replace function public.redeem_invite()
returns table (state text, member_id uuid, org_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_auth_id uuid;
  caller_email text;
  invite public.member_invites;
  existing_member_id uuid;
begin
  caller_auth_id := auth.uid();
  if caller_auth_id is null then
    raise exception 'redeem_invite requires an authenticated session';
  end if;

  select m.id into existing_member_id from public.members m where m.auth_user_id = caller_auth_id;
  if existing_member_id is not null then
    return query
      select 'redeemed'::text, m.id, m.org_id from public.members m where m.id = existing_member_id;
    return;
  end if;

  select email into caller_email from auth.users where id = caller_auth_id;

  select * into invite from public.member_invites
  where email = caller_email and redeemed_at is null
  order by invited_at desc
  limit 1;

  if invite is null then
    return query select 'unavailable'::text, null::uuid, null::uuid;
    return;
  end if;

  if invite.expires_at < now() then
    return query select 'expired'::text, null::uuid, null::uuid;
    return;
  end if;

  update public.members set auth_user_id = caller_auth_id where id = invite.member_id;

  update public.memberships
  set status = 'active', activated_at = now()
  where memberships.member_id = invite.member_id and memberships.status = 'invited';

  update public.member_invites set redeemed_at = now() where id = invite.id;

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  select m.org_id, m.id, 'redeem_invite', 'member_invites', invite.id, 'Member redeemed an invite'
  from public.members m where m.id = invite.member_id;

  return query
    select 'invited'::text, m.id, m.org_id from public.members m where m.id = invite.member_id;
end;
$$;

revoke execute on function public.redeem_invite() from public;
grant execute on function public.redeem_invite() to authenticated;

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

-- The first path segment is regex-validated before the ::uuid cast: casting
-- an arbitrary, non-UUID-shaped object name would raise an opaque Postgres
-- cast error instead of a clean policy denial.
create policy source_documents_storage_founder_read
  on storage.objects for select
  using (
    bucket_id = 'source-documents'
    and (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_active_founder(((string_to_array(name, '/'))[1])::uuid)
  );

create policy source_documents_storage_founder_write
  on storage.objects for insert
  with check (
    bucket_id = 'source-documents'
    and (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.is_active_founder(((string_to_array(name, '/'))[1])::uuid)
  );

-- Uploaded documents are evidence for an eventual contract; they are not
-- edited or deleted through the app once uploaded. Deletion, if ever needed,
-- is an explicit founder/ops action outside this MVP, not a policy to design
-- around here.
