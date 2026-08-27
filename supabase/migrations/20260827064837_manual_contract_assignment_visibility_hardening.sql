-- Development-parity hardening for the manual-contract boundary.
-- A matching member_id alone is not authority to read an assignment: a member
-- must still hold an active, approved assignment on that opportunity.
drop policy if exists assignments_select_self on public.assignments;

create policy assignments_select_self on public.assignments
  for select
  to authenticated
  using (
    member_id = public.current_member_id()
    and status = 'approved'
    and public.is_assigned_to_opportunity(opportunity_id)
  );

-- This canonical serializer is an implementation detail of the founder-only
-- setup RPC. It is not a browser API, including for authenticated callers.
revoke execute on function public.manual_contract_setup_request_fingerprint(
  uuid, text, text, text, bigint, text, integer, jsonb
) from public;
revoke execute on function public.manual_contract_setup_request_fingerprint(
  uuid, text, text, text, bigint, text, integer, jsonb
) from anon;
revoke execute on function public.manual_contract_setup_request_fingerprint(
  uuid, text, text, text, bigint, text, integer, jsonb
) from authenticated;
