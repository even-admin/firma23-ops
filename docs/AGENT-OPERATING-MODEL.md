# FIRMA23 agent operating model

Purpose: preserve quality without running premium reasoning sessions as resident
builders or monitors. FIRMA23 currently operates from one active workspace with
a deliberate model baton, rather than a collection of concurrent writer lanes.

## Model routing

| Work | Default | Hard limit |
| --- | --- | --- |
| Control planning, architecture and integration decisions | SOL or Opus | 15–45 minutes |
| Long-running bounded implementation | Terra or 5.5 | One 2–4 hour work unit |
| Quick bounded implementation or repair | Sonnet | One focused work unit |
| Mechanical checks and evidence | Smallest capable model | Terminal result |
| Independent adversarial audit | Fable | Read-only against a committed SHA |

SOL and Opus do not wait on CI, poll workflows, read repetitive logs, perform
routine implementation, run overnight fix loops or remain resident across four
projects. They produce a decision or a work packet, then stop.

## Portfolio guardrails

- One active FIRMA23 workspace is the default. Multiple model tabs may be open,
  but exactly one session may edit tracked or ignored workspace files at a time.
- Maximum one premium reasoning session active across all projects.
- A long-running Terra/5.5 builder owns one bounded work unit. It commits its
  result and parks before Sonnet begins a repair.
- Fable audits a clean, committed SHA read-only. Its report is returned in chat
  or written only after the active writer is parked, so it never races a writer.
- Control sessions are parked while builders execute.
- After three failed implementation/review loops, stop and re-plan.
- An overnight run means bounded work units that terminate independently, not one
  conversation accumulating context for twenty hours.

Create another workspace only when two code changes must truly proceed in
parallel and can have exclusive ownership from a pushed, exact base SHA. It is
not a substitute for a model handoff.

## Session contract

Every builder receives:

1. Exact workspace, branch, base SHA and objective.
2. Exclusive owned files and explicit frozen files.
3. Required and prohibited behavior.
4. Narrow tests, full handoff checks and browser evidence requirements.
5. Stop conditions and a maximum of one logical commit or 2–4 hours.
6. A tracked handoff containing final SHA, changes, evidence and unavailable work.
7. No push, merge, deploy, migration or provider action without explicit scope.

## FIRMA23 baton

1. SOL creates or reviews a short work packet: exact SHA, scope, invariants,
   owned files, stop condition and evidence. It then parks.
2. Terra or 5.5 is the primary builder for that packet. It implements, verifies,
   commits one logical result and writes a concise handoff. It then parks.
3. Sonnet handles only a clearly bounded follow-up repair, never overlapping the
   Terra writer. It commits and parks.
4. Fable audits the resulting exact SHA without editing product files. Findings
   must cite an executable acceptance condition.
5. SOL returns only for a disputed architecture, security, finance or release
   decision. Otherwise the next Terra/5.5 packet begins from the accepted SHA.

For the current operational V1, the work packets follow
`docs/OPERATIONAL-V1-SHIP-PLAN.md`: document ingestion first, then canonical
configured reads, media, XP and final configured-browser acceptance.

Do not create another route workspace until the current integrated branch is
published as an explicitly authorized base. Historical UI lanes are archive-only.
