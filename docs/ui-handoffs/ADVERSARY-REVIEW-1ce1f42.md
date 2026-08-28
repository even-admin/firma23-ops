# Adversarial review brief — `1ce1f42`

## Candidate

- Workspace: `/Users/racosta/conductor/workspaces/firma23-ops/overnight-ui-ops`
- Branch: `overnight-ui-ops`
- Review SHA: `1ce1f42aaf08795f128c9ca5a875f06db3069ce1`
- Base: `51a56f049482997e1b42130c2186acac32b4b6cf`
- Scope commits:
  - `0f3f258` monochrome filter controls;
  - `73baae2` persistent circular avatar geometry; and
  - `1ce1f42` neutral visual surfaces plus founder Invite Center.

## Ask of the adversary

Audit this exact SHA read-only. Do not edit, install, push, deploy, apply
migrations, use Supabase, send email, create Auth users, or access credentials.

Lead with BLOCKER/HIGH findings and cite an executable acceptance condition for
each. Accept only when no unresolved BLOCKER/HIGH remains.

### Critical checks

1. **Invite authority:** only an active founder of the same organization can
   create or list invitations; a member, cross-organization caller, anon role,
   or direct table insert cannot create a partial invite.
2. **Replay safety:** idempotent replay returns the original command outcome;
   a changed request with the same key, including former delimiter-collision
   shapes, must fail.
3. **Isolation:** creation makes only a member, invited membership, unavailable
   profile, invite, command receipt, and audit event. It creates no Auth user,
   email delivery claim, cash event, settlement, payout, stat event, XP, or
   earned/paid money.
4. **Configured/synthetic truth:** configured mode uses only the Supabase
   repository; synthetic mode reports the action unavailable rather than
   fabricating success.
5. **UI permission and accessibility:** `/admin/members` denies non-founders;
   the form uses 44px controls, visible focus, busy/error announcement, and
   explicitly says that an invitation does not send email.
6. **Visual contract:** filter controls are black/white/neutral segmented
   instruments; identity orbs remain circular during hover/focus/active;
   changed global surfaces and Mesh fallbacks have no CSS gradient or decorative
   color. Preserve ledger green, amber, and red for semantic states only.
7. **Migration discipline:** new migration is additive, applies from zero,
   keeps RLS on exposed tables, pins the function search path, and does not
   weaken historical finance/Auth controls.

## Evidence available

- `git diff --check`: PASS.
- `./scripts/db-verify.sh`: **179 passed, 0 failed**. Scenario 23 covers
  normalized storage, replay, collision rejection, member denial, and direct
  insert denial.
- Independent local review: PASS, no BLOCKER/HIGH.

## Known limits

- `npm run lint`, `npm run typecheck`, `npm test`, and build are UNAVAILABLE in
  this clean worktree because dependency executables are absent; no install was
  performed.
- No browser run was performed from this candidate.
- Migration is committed but unapplied. No invitation email/Auth user is created
  by this slice, and no Supabase/remote/deployment action occurred.
- Existing unrelated chart gradients in `PerformanceInstrument.tsx` are outside
  this candidate's changed surface set; they require a later dedicated review.
