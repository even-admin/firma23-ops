alter function public.guard_assignment_role_key()
  set search_path = public, pg_temp;

revoke execute on function public.member_opportunity_financials() from anon;
