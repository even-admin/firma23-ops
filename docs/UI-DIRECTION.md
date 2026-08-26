# FIRMA23 UI direction

Status: approved V1 direction.

## Design thesis

FIRMA23 is a young creative studio first and a private members club second.
Its interface is an editorial atelier first and abstract spatial software second:
authority surfaces behave like records, system surfaces behave like instruments,
and player surfaces reward verified outcomes without turning telemetry into status.

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

Use technical density, causal processing motion and bounded atmospheric fields for
intake, evidence and future connectors. A disconnected, degraded, synthetic or
unavailable system must look like that state. Motion may never imply a live or
healthy connection without provider evidence.

### Player

Use a monochrome pixel language for member identity, future XP and ranking.
Player surfaces celebrate approved outcomes, useful skills, portfolio evidence
and availability. Tokens, spend, commits, lines of code and raw AI activity do
not create status, earnings, XP or rank.

### Signature

Preserve `MeshDriftCanvas` at full environmental scale on Home only. Its exact
shader pipeline also renders inside the bounded `IdentityOrb`, using five approved
palettes selected deterministically from `memberId`. The orb has no initials,
photo or semantic colour and never expands into an environmental wash.
`ProjectCover` is the other bounded gradient exception: deterministic editorial
artwork that identifies a project without encoding its status. No generic AI
artwork, rainbow metrics or unbounded decorative wash is allowed.

## Product truth

- Every amount renders through `Amount` with tabular numerals.
- Draft/projected, approved, paid, actual provider cost, estimated API-equivalent
  cost and allocated subscription cost remain distinct concepts.
- Projected subtrees contain zero `money` classes.
- Ledger green is reserved for confirmed money and primary completion.
- Amber means attention. Red means destructive or failed.
- Ranking uses approved earnings only and retains provenance.
- Members may compare team rank and approved totals, but another member's paid
  and projected figures remain private. Omitted fields stay omitted rather than
  rendering as zero.
- Settlement reversals never erase cash that was historically paid. When paid
  exceeds the currently approved amount, the difference is an explicit recovery
  amount, not a negative payable balance or hidden payout.
- A reversed settlement without a real pending replacement is
  `correction_required`, not a fresh projection. That state carries no projected
  amount or allocation segments and contributes zero projected earnings.
- Owed and recovery are reconciled per settlement line before aggregation. A
  reversed recipient's recovery may never cancel an active line's obligation;
  only a signed `-old/+new` payout allocation transfer resolves both sides.
- Comparative trend charts and period-over-period deltas remain unavailable until
  a frozen model contains at least two complete comparable periods. Inicio may
  render cumulative event history when every plotted observation comes from a
  dated settlement, payout, correction or stat event. A visual curve may connect
  exact observations, but the product never creates intermediate data points.
- Components consume repository-backed view models and never import `src/data/**`.
- AI may draft, extract or explain. It may not approve contracts, assignments,
  settlements, payouts or other financial mutations.
- Telemetry is evidence, never money, earnings, XP or rank.

## V1 placement

### Home (`/`)

Use one two-card Personal Command Strip above the existing action and assignment
queues. The compact `MeshDriftCanvas` identity field carries only the member name,
local date/time and active-operation count. The adjacent performance instrument
switches among approved, paid, payable, projected and verified-close metrics.
Historical lines connect exact cumulative event balances, and event mode exposes
the signed source movements; neither contains inferred daily values. Projection
shows a current value without a line until dated projection events exist.

### Contracts (`/opportunities`)

Use dense opportunity rows. Opportunity detail keeps Revenue Rail, assigned crew
and one semantic milestone timeline. Project-wide health waits for a real
aggregate model; no invented score or trend is permitted.

### Network (`/network`)

Evolve Operator Card into the Player identity surface using only existing
skills, outcomes, approved earnings and availability. Member artwork uses
the decorative `IdentityOrb` wherever a stable `memberId` already exists. No
remote avatars, fake people or telemetry competition. Glass is reserved for
lightweight controls and identity framing, never data records.

### Performance (`/leaderboard`)

Use an ordered approved-earnings list with provenance. No podium theatrics,
tokens, XP, projected rank or founder adjudication rules beyond the current
approved model.

### Proyectos

Use a responsive record table at 768px and above and structured rows below 768px.
Every project receives deterministic editorial cover artwork until an authorized
project image/palette model exists. Opportunity records inherit that identity
subtly. Project detail adopts an exact header, services, opportunities and rule
history from the existing view model.

### Admin

Prioritize the document packet, truthful intake stepper, extracted fields and
evidence, review issues and the existing finance snapshot. Manual creation stays
the fallback to document-first intake. Completion follows real processing state,
never decorative animation. Confirmation and discard outcomes must catch both
typed failures and rejected actions, announce the result and move focus to it.

### Finanzas and settlement

Remain strict Authority Mode. Preserve Revenue Rail semantics and the existing
finance composition. Do not add a chart, count-up money animation or optimistic
approval state.

### Later surfaces

`/admin/compute`, subscriptions, connectors, provider usage, XP/player
progression, PDF viewing, community/chat, kanban and rare delight are outside V1.
Each requires its named data, permission or privacy trigger before UI work starts.

The Home performance-history extension is a read-only view-model addition. It does
not change a repository method, domain entity, financial rule or write contract.

## Shared pattern resolution

### Metrics

Do not create one universal KPI card. Home uses its Personal Command Strip;
finance keeps `FinanceMetricCard`; non-money metrics use route-local compact `dl`
compositions. Deltas require real comparable periods.

### Timelines

The Integrator may create one shared `ProcessTimeline` after at least two real
route requests. It must represent intake, milestones and provenance through
semantic events, without commerce language or invented timestamps.

### Tables

Use one FIRMA23 responsive record grammar, not HeroUI. Render a semantic table
only when its content chamber is at least 864px wide and a structured list below
that width. This is a container decision, not a viewport decision: a transiently
expanded sidebar must never compress a desktop table into collisions. Mobile is
recomposed, never a horizontally scrolling desktop table.

### Spatial surfaces

Focused studio objects use a 20px boundary, member/project objects 16px, authority
records 12px, and controls 10-12px. Object cards use generous internal rhythm and at most one
structural divider between information zones. Internal facts group through space,
alignment and quiet surface shifts instead of nested bordered cards. Compact tags
use 4px radii and are filled or outlined only when the distinction is meaningful.
Authority records may remain denser, but repeated equal-weight boxes are not the
default visual grammar.

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
- No gradients or shadows except `MeshDriftCanvas`, `IdentityOrb`, `ProjectCover`,
  the tokenized chart tint and SVG area fill inside `PerformanceInstrument`, and
  the focus ring. The chart exception is data-bound and may not imply unavailable
  history, projection confidence or financial status that the source does not prove.
- No hardcoded hex outside `src/app/tokens.css`.
- No foreign branding, monograms, horses, generic AI decoration or accent colors.
- Radius communicates hierarchy: 20px focused studio objects, 16px member/project
  objects, 12px authority records and 10-12px controls. Cards never nest inside
  decorative cards.
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
  At 768px the expanded desktop rail must remain geometrically separate from
  main content, keep its focused control visible and preserve its panel border.
- Founder and member presentations remain distinct; real Development Auth is a
  separate mode and may be marked unavailable honestly.
- Loading, empty, error, denied, unavailable and stale states are truthful where
  applicable.
- Projected, approved and paid money remain visually and structurally distinct.
- Dynamic invalid routes return HTTP 404, not only a not-found presentation.
- Console contains zero application errors and unexpected network failures.
- Async Admin operations expose a visible polite pending status. Every retry is
  accepted only after the complete outcome focus, live-region, target-size and
  non-occlusion inspection runs again.
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

V1 leaderboard provenance follows the existing financial authority boundary:
founders may inspect every approved line; a member may inspect only their own
line-level provenance. Members may still see eligible team rank and approved
totals, but never another member's paid total, projected total, beneficiary,
payout, approver, or settlement line detail. Until RLS-backed read repositories
replace the synthetic adapters, configured sessions must carry a persistent
non-canonical-data disclosure.
