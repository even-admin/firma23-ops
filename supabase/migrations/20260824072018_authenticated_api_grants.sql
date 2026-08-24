-- FIRMA23 Ops - explicit Data API grants for authenticated members.
--
-- Supabase no longer exposes new public tables to the Data API by default.
-- RLS remains the row-level authority; these grants only make the operations
-- already represented by policies reachable by the authenticated role.

grant usage on schema public to authenticated;
revoke all on schema public from anon;

-- Shared read surfaces. RLS narrows each result to the caller's organization,
-- assignments, or own financial lines.
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

-- Member-owned profile and evidence surfaces.
grant select, insert, update on table public.member_profiles to authenticated;
grant select, insert, update, delete on table
  public.member_skills,
  public.portfolio_items
to authenticated;
grant select, insert on table public.evidence_links to authenticated;

-- Founder-managed project and execution surfaces. The corresponding RLS
-- policies retain founder control; assignees only receive the narrower paths
-- encoded by those same policies.
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

-- No public/anonymous table access. Authenticated finance writes still have
-- no direct table privilege and must use the audited RPC boundary.
revoke all on all tables in schema public from anon;
