-- Minimal stand-ins for the parts of Supabase's auth/storage schemas the
-- migrations reference (auth.users, auth.uid(), storage.buckets/objects
-- with RLS enabled), plus the anon/authenticated/service_role roles
-- Supabase grants against by default. Not a Supabase project — a disposable
-- local Postgres instance the migrations can run against unmodified.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase's real auth.uid() reads a JWT claim via current_setting. This
-- harness sets the same GUC directly with SET LOCAL/SET per session.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
grant select, insert on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
-- Matches a real Supabase project's actual default privileges: newly created
-- functions grant EXECUTE to anon AND authenticated, not authenticated
-- alone. Every RPC that must stay unauthenticated-proof has to explicitly
-- revoke from anon, not rely on this stub being more conservative than
-- production — that gap (H2) is exactly what let a missing anon revoke go
-- undetected by this harness before.
alter default privileges in schema public grant execute on functions to anon, authenticated;
