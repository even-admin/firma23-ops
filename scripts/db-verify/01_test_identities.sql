-- Links two seeded members to auth.users rows and activates their
-- memberships, so the scenario tests below can impersonate them by setting
-- request.jwt.claim.sub. Only ever done against this disposable instance.

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'founder@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'operator@test.local');

update public.members set auth_user_id = '11111111-1111-4111-8111-111111111111'
where id = 'b0000000-0000-4000-8000-000000000001'; -- Luis, founder

update public.members set auth_user_id = '22222222-2222-4222-8222-222222222222'
where id = 'b0000000-0000-4000-8000-000000000003'; -- Sebastian, member

update public.memberships set status = 'active', activated_at = now()
where member_id in (
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000003'
);

-- A second organization, for cross-org isolation tests.
insert into public.organizations (id, slug, name)
values ('a0000000-0000-4000-8000-00000000000f', 'other-org', 'Other Org');
insert into auth.users (id, email) values ('33333333-3333-4333-8333-333333333333', 'other-founder@test.local');
insert into public.members (id, org_id, slug, display_name, initials, role, auth_user_id) values
  ('b0000000-0000-4000-8000-0000000000ff', 'a0000000-0000-4000-8000-00000000000f', 'other-founder', 'Other Founder', 'OF', 'founder', '33333333-3333-4333-8333-333333333333');
insert into public.memberships (org_id, member_id, status, activated_at) values
  ('a0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-0000000000ff', 'active', now());
insert into public.source_documents (id, org_id, uploaded_by_member_id, filename, kind) values
  ('90000000-0000-4000-8000-0000000000ff', 'a0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-0000000000ff', 'other-doc.pdf', 'quote');

-- A founder whose membership has since been revoked, for authorization tests.
insert into auth.users (id, email) values ('44444444-4444-4444-8444-444444444444', 'revoked-founder@test.local');
insert into public.members (id, org_id, slug, display_name, initials, role, auth_user_id) values
  ('b0000000-0000-4000-8000-0000000000fe', 'a0000000-0000-4000-8000-000000000001', 'revoked-founder', 'Revoked Founder', 'RF', 'founder', '44444444-4444-4444-8444-444444444444');
insert into public.memberships (org_id, member_id, status, activated_at, invited_at) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000fe', 'revoked', null, now());

-- A fresh, controlled 2-line approved settlement on opportunity 3 (SETY
-- rule), isolated from the fixture settlement on opportunity 2, so the
-- reversal-exactness scenarios below are unambiguous and don't disturb the
-- seeded fixture data.
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-fixture-original-o3');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, 90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, 210000, 'MXN', 2);
commit;
