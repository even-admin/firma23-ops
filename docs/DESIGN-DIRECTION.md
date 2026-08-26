# Design direction

## Intent

The user is a talented young operator moving between leads, client visits, production tasks, and collections. They open the app to see what they can work on, how their friends are performing, what they have earned, and what action moves them forward.

The product should feel fast, ambitious, social, precise, and private. Take inspiration from Whop's app density, clear balances, compact navigation, avatars, quick actions, and builder energy without copying its brand or marketplace structure.

## Product world

- Closings.
- Handoffs.
- Production crews.
- Evidence.
- Program deadlines.
- Collections.
- Allocation and settlement.
- Skill growth.
- Portfolios.
- Friendly competition.

## Color world

- Ink black.
- Graphite.
- Paper white.
- Soft steel gray.
- Ledger green only for confirmed money and primary completion.
- Muted amber only for items requiring attention.
- Muted red only for destructive actions or failed states.

No gradients outside the two named signature exceptions below. No decorative
rainbow metrics. Use a borders-first depth system with quiet surface shifts.

The shell's animated `MeshDriftCanvas` background
(`src/components/visual/MeshDriftCanvas.tsx`) remains the only gradient and grain
environment. Its approved palette, drift speed, grain, and WebGL fallback stay
as built; `prefers-reduced-motion: reduce` freezes it on its current frame rather
than blanking it.

`IdentityOrb` is the only additional gradient exception. It is a small circular,
decorative member identifier with six tokenized palettes selected deterministically
from `memberId`. It contains no initials or photo and never communicates role,
availability, rank, earnings, money state, attention or failure. It uses CSS only,
stays static by default, and removes its restrained hover/focus transform under
reduced motion.

## Signature component: Revenue Rail

Each opportunity includes a horizontal financial rail. Its segments represent house participation, closer allocation, and delivery roles. Each segment contains the assigned person's avatar or initials. The rail must distinguish projection from approved settlement and explain the project-specific distributable base.

The same signature appears in:

1. Opportunity list rows.
2. Opportunity financial detail.
3. Founder finance dashboard.
4. Settlement approval dialog.
5. Leaderboard provenance view.

## Community signature: Operator Card

Member identity is not a generic avatar and title. Each Operator Card combines verified skills, recent project evidence, approved earnings, close and delivery stats, availability, and the next capability being built. It should make a member feel that real work is compounding into a professional reputation.

## Replace generic dashboard defaults

- Replace four disconnected KPI cards with one operational header combining approved money, pending money, active work, and the primary action.
- Replace a spreadsheet-style master table with opportunity and assignment flows.
- Replace a wide SaaS sidebar with a compact rail that prioritizes Home, Opportunities, Network, Leaderboard, and Admin.
- Replace decorative charts with actionable queues and exact amounts.

## Typography and spacing

- Use a distinctive grotesk or editorial sans suitable for FIRMA23, selected from locally available or properly licensed web fonts.
- Use tabular numerals for money.
- Use a 4px base spacing unit with primary layout intervals on an 8px rhythm.
- Keep radii restrained and consistent.
- Motion is quick deceleration, never bounce or spring.

## Required states

Every screen and data component needs loading, empty, error, disabled, focus, hover, and successful completion states. Mobile layouts must preserve the primary action and financial status without horizontal page scrolling.
