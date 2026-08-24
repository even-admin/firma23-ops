-- FIRMA23 Ops - pin every remaining public function search path.
--
-- Trigger helpers run as their invoker, but a mutable path still permits
-- object shadowing. Keep the reviewed function bodies unchanged and make
-- public resolution explicit, with pg_temp searched last.

alter function public.check_allocation_shares_total() set search_path = public, pg_temp;
alter function public.check_one_unreversed_approved_original() set search_path = public, pg_temp;
alter function public.check_payout_cash_event_reconciles() set search_path = public, pg_temp;
alter function public.check_settlement_line_payout_matches_event() set search_path = public, pg_temp;
alter function public.check_settlement_line_payout_within_line() set search_path = public, pg_temp;
alter function public.check_settlement_line_reversal_exact() set search_path = public, pg_temp;
alter function public.check_settlement_lines_sum() set search_path = public, pg_temp;
alter function public.check_settlement_reversal_exact() set search_path = public, pg_temp;
alter function public.forbid_mutation() set search_path = public, pg_temp;
alter function public.guard_ai_contract_draft_org_consistency() set search_path = public, pg_temp;
alter function public.guard_assignment_role_key() set search_path = public, pg_temp;
alter function public.guard_intake_run_org_consistency() set search_path = public, pg_temp;
alter function public.guard_milestone_assignee_update() set search_path = public, pg_temp;
alter function public.guard_settlement_line_currency() set search_path = public, pg_temp;
alter function public.guard_settlement_line_payout_insert() set search_path = public, pg_temp;
alter function public.guard_settlement_reversal_matches_original() set search_path = public, pg_temp;
alter function public.guard_settlement_update() set search_path = public, pg_temp;
alter function public.guard_stat_event_reversal() set search_path = public, pg_temp;
alter function public.split_by_weights_centavos(bigint, integer[]) set search_path = public, pg_temp;
alter function public.validate_settlement_reversal_exact(uuid) set search_path = public, pg_temp;
