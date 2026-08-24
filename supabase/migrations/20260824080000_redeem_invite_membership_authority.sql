-- FIRMA23 Ops — M2 Auth repair: redeem_invite() membership-authority,
-- normalization, and atomicity fixes.
--
-- Findings: .context/architecture-council/m2-auth-adversarial-review.md
-- (H2, M1, M5). Additive-only over 20260821090500_invites_and_storage.sql,
-- which is not rewritten — `create or replace function` redefines
-- redeem_invite() in place, the normal way to correct a function body
-- without touching the migration that first created it, and the new unique
-- index below is a new object, not an edit to the existing table.
--
-- H2 — a revoked membership must never report 'redeemed' or let the caller
-- build a privileged ViewerContext. The early-return branch (an
-- already-linked auth_user_id) previously proved nothing about the
-- membership behind that link: it read only public.members, never
-- public.memberships, so a founder revoking someone's membership left
-- redeem_invite() still answering 'redeemed' forever. That branch now
-- requires an ACTIVE membership row. A linked-but-not-active membership
-- returns its own 'revoked' state, with null member_id/org_id — the same
-- shape 'expired'/'unavailable' already use for "nothing to build a
-- ViewerContext from" — and src/data/viewer-session.ts maps it to its own
-- honest ViewerSessionState, never to { kind: 'viewer' }.
--
-- M1 — Supabase Auth normalizes email addresses to lowercase; this RPC did
-- not, so an invite typed as `Contacto@LuisRAcosta.com` could never match
-- the auth.users row Supabase itself lowercases on sign-in, leaving a
-- legitimately invited person permanently 'unavailable' with no visible
-- cause. Both sides of the match are now `lower(btrim(...))`, and a new
-- unique index enforces the same normalization at the table level so two
-- invites differing only by case or incidental whitespace can never coexist
-- going forward — existing rows are untouched; the index only constrains
-- future inserts.
--
-- M5 — the original body selected the candidate invite with
-- `redeemed_at is null` and no lock, then ran three updates and an
-- audit_events insert. viewer-session.ts calls this RPC on every page load,
-- and concurrent RSC requests for the same still-unlinked session are the
-- normal case, not an edge case — two such calls could both pass the
-- "not yet redeemed" check and both write an audit row for one redemption.
-- The candidate invite is now locked with `for update` before that check:
-- the second concurrent caller blocks until the first commits, then its own
-- `for update` re-evaluates the row's current state and no longer matches
-- `redeemed_at is null` (the winner already set it), so `invite` is null
-- for the loser — handled by a dedicated fallback that recognizes "this
-- email's invite is redeemed and now points at my own auth_user_id" and
-- returns 'redeemed' instead of a false 'unavailable', without a second
-- write of any kind.

create unique index member_invites_email_lower_unique
  on public.member_invites (lower(btrim(email)));

create or replace function public.redeem_invite()
returns table (state text, member_id uuid, org_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_auth_id uuid;
  caller_email text;
  invite public.member_invites;
  existing_member_id uuid;
  existing_org_id uuid;
  existing_membership_status text;
begin
  caller_auth_id := auth.uid();
  if caller_auth_id is null then
    raise exception 'redeem_invite requires an authenticated session';
  end if;

  -- H2: an auth_user_id already linked to a member row is not, by itself,
  -- proof of current authority — a founder can revoke a membership without
  -- ever touching this row. is_active_founder()/is_active_member() are what
  -- RLS actually checks (membership status, not merely "is a link
  -- present"), so this branch has to check the same thing.
  select m.id, m.org_id, ms.status
    into existing_member_id, existing_org_id, existing_membership_status
  from public.members m
  join public.memberships ms on ms.member_id = m.id and ms.org_id = m.org_id
  where m.auth_user_id = caller_auth_id;

  if existing_member_id is not null then
    if existing_membership_status = 'active' then
      return query select 'redeemed'::text, existing_member_id, existing_org_id;
      return;
    end if;
    -- Linked but not active (revoked, or any future non-active status):
    -- never 'redeemed', and no member_id/org_id a caller could use to
    -- build a privileged ViewerContext from this branch alone.
    return query select 'revoked'::text, null::uuid, null::uuid;
    return;
  end if;

  -- M1: normalize both sides — Supabase Auth already lowercases the email
  -- on the auth.users row; a founder-entered invite must match regardless
  -- of how they capitalized or spaced it.
  select lower(btrim(email)) into caller_email from auth.users where id = caller_auth_id;

  -- M5: lock the candidate invite row before checking redeemed_at, so two
  -- concurrent first-logins for the same invite cannot both observe
  -- "not yet redeemed" and both proceed. The second caller blocks here
  -- until the first's transaction commits.
  select * into invite from public.member_invites
  where lower(btrim(email)) = caller_email and redeemed_at is null
  order by invited_at desc
  limit 1
  for update;

  if invite is null then
    -- Either no invite ever existed for this email, or the one that did was
    -- just redeemed by a concurrent call that won the race above (the lock
    -- released, and this select's own where clause no longer matches the
    -- now-redeemed row). Distinguish the two: if this email's invite is
    -- redeemed and points at *this caller's own* auth_user_id, the race was
    -- against ourselves — report 'redeemed', not a false 'unavailable', and
    -- write nothing.
    select m.id, m.org_id
      into existing_member_id, existing_org_id
    from public.member_invites mi
    join public.members m on m.id = mi.member_id
    where lower(btrim(mi.email)) = caller_email
      and mi.redeemed_at is not null
      and m.auth_user_id = caller_auth_id;

    if existing_member_id is not null then
      return query select 'redeemed'::text, existing_member_id, existing_org_id;
      return;
    end if;

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
revoke execute on function public.redeem_invite() from anon;
grant execute on function public.redeem_invite() to authenticated;
