-- FIRMA23 Ops - remove inherited PUBLIC Data API privileges.
--
-- Hosted Supabase grants some public-schema privileges through PostgreSQL's
-- PUBLIC pseudo-role. Revoking from `anon` alone does not remove privileges
-- inherited from PUBLIC, so finance tables could still appear writable at
-- the grant layer even though RLS denied every row. Keep the audited RPCs as
-- the only finance write door by removing that inherited surface.

revoke all on all tables in schema public from public;
revoke usage on schema public from public;

-- Reassert the only schema access intended for the browser-facing API role.
-- Table-level grants remain those declared in the preceding migration.
grant usage on schema public to authenticated;
