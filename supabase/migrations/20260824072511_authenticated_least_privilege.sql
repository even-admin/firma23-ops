-- FIRMA23 Ops - rebuild authenticated table privileges from zero.
--
-- Hosted Supabase may grant broad table privileges directly to the
-- `authenticated` role. Remove those defaults before reapplying the exact
-- operation matrix represented by the reviewed RLS policies.

revoke all on all tables in schema public from authenticated;
grant usage on schema public to authenticated;

grant select on table
  public.organizations,
  public.members,
  public.memberships,
  public.skills,
  public.cash_events,
  public.settlements,
  public.settlement_lines,
  public.settlement_line_payouts,
  public.stat_events,
  public.intake_runs,
  public.ai_contract_drafts,
  public.audit_events,
  public.payout_command_receipts
to authenticated;

grant select, insert, update on table public.member_profiles to authenticated;
grant select, insert, update, delete on table
  public.member_skills,
  public.portfolio_items
to authenticated;
grant select, insert on table public.evidence_links to authenticated;

grant select, insert, update, delete on table
  public.projects,
  public.opportunities,
  public.assignments,
  public.opportunity_milestones
to authenticated;

grant select, insert on table
  public.service_versions,
  public.milestone_templates,
  public.allocation_rule_versions,
  public.allocation_shares,
  public.source_documents,
  public.member_invites
to authenticated;
