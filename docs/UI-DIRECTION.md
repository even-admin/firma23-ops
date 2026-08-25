# FIRMA23 UI direction

Status: approved V1 direction.

## Design thesis

FIRMA23 is an operational game whose authority surfaces behave like records,
system surfaces behave like instruments, and player surfaces reward verified
outcomes without turning telemetry into status.

This is a private operating network, not the public FIRMA23 site. The interface
must help a young operating team understand real work, permissions, evidence and
money without making the underlying authority feel casual.

## Visual modes

### Authority

Use paper white, exact values, compact hierarchy and restrained motion for
contracts, finance, approvals, settlements and audit. Depth comes from borders
and quiet surface changes. Projected money never uses ledger green and never
appears approved, earned or payable.

### Systems

Use technical density, causal processing motion and selective dark chambers for
intake, evidence and future connectors. A disconnected, degraded, synthetic or
unavailable system must look like that state. Motion may never imply a live or
healthy connection without provider evidence.

### Player

Use a monochrome pixel language for member identity, future XP and ranking.
Player surfaces celebrate approved outcomes, useful skills, portfolio evidence
and availability. Tokens, spend, commits, lines of code and raw AI activity do
not create status, earnings, XP or rank.

### Signature

Preserve `MeshDriftCanvas` at full character on Home only. It is the sole
gradient and grain exception. No other component may introduce gradients,
decorative color washes, grain or generic AI artwork.

## Product truth

- Every amount renders through `Amount` with tabular numerals.
- Draft/projected, approved, paid, actual provider cost, estimated API-equivalent
  cost and allocated subscription cost remain distinct concepts.
- Projected subtrees contain zero `money` classes.
- Ledger green is reserved for confirmed money and primary completion.
- Amber means attention. Red means destructive or failed.
- Ranking uses approved earnings only and retains provenance.
- Historical charts remain unavailable until a frozen model contains at least
  two complete comparable periods.
- Components consume repository-backed view models and never import `src/data/**`.
- AI may draft, extract or explain. It may not approve contracts, assignments,
  settlements, payouts or other financial mutations.
- Telemetry is evidence, never money, earnings, XP or rank.

## V1 placement

### Inicio

Preserve `OperationalHeader` and `MeshDriftCanvas`. Refine next actions and
assignments using the existing `PersonalHome` model. Do not replace the home
surface with generic KPI cards or a marketing hero.

### Oportunidades

Use dense opportunity rows. Opportunity detail keeps Revenue Rail, assigned crew
and one semantic milestone timeline. Project-wide health waits for a real
aggregate model; no invented score or trend is permitted.

### Red

Evolve Operator Card into the Player identity surface using only existing
skills, outcomes, approved/paid earnings and availability. No remote avatars,
fake people, glass effects or telemetry competition.

### Ranking

Use an ordered approved-earnings list with provenance. No podium theatrics,
tokens, XP, projected rank or founder adjudication rules beyond the current
approved model.

### Proyectos

Use a responsive record table at 768px and above and structured rows below 768px.
Project detail adopts an exact header, services, opportunities and rule history
from the existing view model.

### Admin

Prioritize the document packet, truthful intake stepper, extracted fields and
evidence, review issues and the existing finance snapshot. Manual creation stays
the fallback to document-first intake. Completion follows real processing state,
never decorative animation.

### Finanzas and settlement

Remain strict Authority Mode. Preserve Revenue Rail semantics and the existing
finance composition. Do not add a chart, count-up money animation or optimistic
approval state.

### Later surfaces

`/admin/compute`, subscriptions, connectors, provider usage, XP/player
progression, PDF viewing, community/chat, kanban and rare delight are outside V1.
Each requires its named data, permission or privacy trigger before UI work starts.

No V1 route, repository interface, view model, domain type or financial contract
change is authorized by this direction.

## Shared pattern resolution

### Metrics

Do not create one universal KPI card. Home keeps `OperationalHeader`; finance
keeps `FinanceMetricCard`; non-money metrics use route-local compact `dl`
compositions. Deltas require real comparable periods.

### Timelines

The Integrator may create one shared `ProcessTimeline` after at least two real
route requests. It must represent intake, milestones and provenance through
semantic events, without commerce language or invented timestamps.

### Tables

Use one FIRMA23 responsive record grammar, not HeroUI. Render a semantic table at
768px and above and a structured list below 768px. Mobile is recomposed, never a
horizontally scrolling desktop table.

### Progress

Revenue Rail remains allocation-only. Operational progress and future XP use
separate neutral meters. Green never communicates generic momentum.

### Menus

Global search remains Foundation-owned. V1 route actions use explicit buttons or
details. An Integrator-owned action menu is allowed only after two routes request
the same real behavior.

### Notices and states

Extend the existing state family through tracked Integrator requests. Route lanes
must not create competing alert, toast or status systems.

## Interaction contract

- Controls are keyboard reachable, visibly focused and at least 44px.
- Dialogs make background controls inert, trap focus and restore the exact opener.
- Motion is causal, quick deceleration and never bounce or spring.
- Reduced motion freezes causal effects without blanking their final state.
- No gradients or shadows except `MeshDriftCanvas` and the focus ring.
- No hardcoded hex outside `src/app/tokens.css`.
- No foreign branding, monograms, horses, generic AI decoration or accent colors.
- Cards use restrained radii and never nest inside decorative cards.
- Mobile recomposes workflows and preserves the primary action and money state.

## Dependency policy

V1 adds zero runtime dependencies. Do not install Framer Motion, `motion`,
Lucide, Recharts, HeroUI, MUI, Radix dropdown/progress, CVA, `tw-animate`,
`next-themes` or remote demo assets. Do not run shadcn initialization.

A PDF viewer receives an isolated technical spike only. Acceptance requires
private-document URLs, bounded bundle impact, keyboard/mobile support, no content
leakage, and clean SSR/CSP behavior. The visual lane cannot land a dependency.

## Acceptance

- Exact widths: 375, 767, 768 and 1280 pixels.
- No horizontal overflow; shell/content boundaries align.
- Active route state, sidebar persistence and mobile active-label behavior work.
- Founder and member presentations remain distinct; real Development Auth is a
  separate mode and may be marked unavailable honestly.
- Loading, empty, error, denied, unavailable and stale states are truthful where
  applicable.
- Projected, approved and paid money remain visually and structurally distinct.
- Dynamic invalid routes return HTTP 404, not only a not-found presentation.
- Console contains zero application errors and unexpected network failures.
- Production `/dev/states` returns 404 and `/favicon.ico` returns 200.
- Lane screenshots are advisory. Only the final integrated exact SHA may pass
  browser acceptance.

## Foundation compatibility

Accepted UI-FOUNDATION SHA:
`27deb897b0cc39979438d225690d72fb50d5b144`.

The accepted chrome, paper-white field, black navigation chamber, focus model,
92px compact/292px transient rail, mobile route bar and Home-only MeshDrift
exception are compatible with this direction and remain frozen for route lanes.
This contract does not authorize rewriting the shell.

Foundation QA found two route-owned heading defects that remain mandatory before
final integration:

- member-denied opportunity detail needs exactly one `h1`;
- member-denied settlement detail needs exactly one `h1`.

## Decisions reserved for Luis

None block V1. Until a later explicit decision:

- Player Mode remains monochrome;
- personal spend remains private;
- founders are excluded from competitive ranking they adjudicate.
