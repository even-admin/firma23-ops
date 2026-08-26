# FIRMA23 agent operating model

Purpose: preserve quality without running premium reasoning sessions as resident
builders or monitors.

## Model routing

| Work | Default | Hard limit |
| --- | --- | --- |
| Control planning and integration | Terra or Sonnet | One 2–4 hour wave |
| Routine bounded implementation | Terra | One work unit |
| Complex implementation | Sonnet | One work unit |
| Mechanical checks and evidence | Smallest capable model | Terminal result |
| Architecture, security or release judgment | SOL or Opus | 15–45 minutes |
| Final adversarial gate | SOL or Opus | After builder evidence exists |

Premium models do not wait on CI, poll workflows, read repetitive logs, perform
routine implementation, run overnight fix loops or remain resident across four
projects.

## Portfolio guardrails

- Maximum one premium session active across all projects.
- Maximum two long-running Terra/Sonnet builders, each in an isolated workspace.
- Control sessions are parked while builders execute.
- After three failed implementation/review loops, stop and re-plan.
- An overnight run means bounded work units that terminate independently, not one
  conversation accumulating context for twenty hours.

## Session contract

Every builder receives:

1. Exact workspace, branch, base SHA and objective.
2. Exclusive owned files and explicit frozen files.
3. Required and prohibited behavior.
4. Narrow tests, full handoff checks and browser evidence requirements.
5. Stop conditions and a maximum of one logical commit or 2–4 hours.
6. A tracked handoff containing final SHA, changes, evidence and unavailable work.
7. No push, merge, deploy, migration or provider action without explicit scope.

## FIRMA23 launch routing

1. Opus/SOL performs the short WU-0 contract/schema freeze from
   `docs/OPERATIONAL-V1-SHIP-PLAN.md`, then stops.
2. Terra/Sonnet builders execute document ingestion, canonical reads, media and
   XP in disjoint workspaces after WU-0.
3. A separate Sonnet/Fable session performs read-only advanced UI review.
4. The control lane integrates exact accepted SHAs and runs final acceptance.

Do not create another route workspace until the current integrated branch is
published as an explicitly authorized base. Historical UI lanes are archive-only.
