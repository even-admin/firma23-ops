-- Founder-managed member invitations. This creates only local operational
-- identity rows; it never creates an Auth user or claims email delivery.

create table public.member_invite_command_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  idempotency_key text not null,
  request_fingerprint text not null,
  member_id uuid not null references public.members(id),
  invite_id uuid not null references public.member_invites(id),
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

alter table public.member_invite_command_receipts enable row level security;

create policy member_invite_command_receipts_select_founder
  on public.member_invite_command_receipts for select
  to authenticated
  using (public.is_active_founder(org_id));

-- The invite command is the only browser-reachable creation path. Remove the
-- historical direct insert path so a client cannot create a partial invite.
drop policy if exists member_invites_founder_insert on public.member_invites;
revoke insert on public.member_invites from authenticated;

create or replace function public.create_member_invite(
  p_org_id uuid,
  p_display_name text,
  p_email text,
  p_idempotency_key text
)
returns table (member_id uuid, invite_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.member_invite_command_receipts;
  v_name text := btrim(p_display_name);
  v_email text := lower(btrim(p_email));
  v_fingerprint text;
  v_slug_base text;
  v_slug text;
  v_initials text;
  v_member_id uuid;
  v_invite_id uuid;
begin
  if public.current_member_id() is null or not public.is_active_founder(p_org_id) then
    raise exception 'founder access required: create_member_invite';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or length(p_idempotency_key) > 200 then
    raise exception 'a valid idempotency key is required';
  end if;
  if v_name is null or v_name = '' or length(v_name) > 120 then
    raise exception 'a valid display name is required';
  end if;
  if v_email is null or v_email = '' or length(v_email) > 320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'a valid email is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':' || p_idempotency_key, 0));
  -- jsonb text is canonical and length-delimited, so values containing the
  -- old pipe separator cannot collide (for example A|B + C vs A + B|C).
  v_fingerprint := encode(extensions.digest(
    jsonb_build_object('org_id', p_org_id, 'display_name', v_name, 'email', v_email)::text,
    'sha256'
  ), 'hex');

  select * into v_receipt
  from public.member_invite_command_receipts
  where org_id = p_org_id and idempotency_key = p_idempotency_key;
  if v_receipt.id is not null then
    if v_receipt.request_fingerprint is distinct from v_fingerprint then
      raise exception 'idempotency key % was already used for a different member invite request', p_idempotency_key;
    end if;
    return query select v_receipt.member_id, v_receipt.invite_id, true;
    return;
  end if;

  if exists (select 1 from public.member_invites where lower(btrim(email)) = v_email) then
    raise exception 'an invitation already exists for this email';
  end if;

  v_slug_base := trim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  if v_slug_base = '' then
    v_slug_base := 'member';
  end if;
  -- Serialize slug allocation per organization/name so concurrent commands
  -- cannot both observe a free slug and race the unique index.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':slug:' || v_slug_base, 0));
  v_slug := v_slug_base;
  while exists (select 1 from public.members where slug = v_slug) loop
    v_slug := v_slug_base || '-' || substr(md5(p_org_id::text || '|' || v_email || '|' || p_idempotency_key), 1, 8);
    if exists (select 1 from public.members where slug = v_slug) then
      v_slug := v_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 4);
    end if;
  end loop;
  v_initials := upper(left(regexp_replace(v_name, '[^[:alnum:]]', '', 'g'), 4));
  if v_initials = '' then
    v_initials := 'M';
  end if;

  insert into public.members (org_id, slug, display_name, initials, role)
  values (p_org_id, v_slug, v_name, v_initials, 'member')
  returning id into v_member_id;

  insert into public.memberships (org_id, member_id, status)
  values (p_org_id, v_member_id, 'invited');

  insert into public.member_profiles (member_id, availability)
  values (v_member_id, 'unavailable');

  insert into public.member_invites (member_id, email)
  values (v_member_id, v_email)
  returning id into v_invite_id;

  insert into public.member_invite_command_receipts (
    org_id, idempotency_key, request_fingerprint, member_id, invite_id
  ) values (p_org_id, p_idempotency_key, v_fingerprint, v_member_id, v_invite_id);

  insert into public.audit_events (org_id, actor_member_id, action, target_table, target_id, summary)
  values (
    p_org_id,
    public.current_member_id(),
    'create_member_invite',
    'member_invites',
    v_invite_id,
    'Founder created a pending member invitation'
  );

  return query select v_member_id, v_invite_id, false;
end;
$$;

revoke execute on function public.create_member_invite(uuid, text, text, text) from public;
revoke execute on function public.create_member_invite(uuid, text, text, text) from anon;
grant execute on function public.create_member_invite(uuid, text, text, text) to authenticated;
