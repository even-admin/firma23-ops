# Design direction

## Intent

The user is an operator moving between leads, client visits, production tasks, and collections. The interface must let them log work in seconds and immediately understand what needs attention and what money is actually approved.

The product should feel fast, ambitious, precise, and private. Take inspiration from Whop's app density, clear balances, compact navigation, avatars, and quick actions without copying its brand or marketplace structure.

## Product world

- Closings.
- Handoffs.
- Production crews.
- Evidence.
- Program deadlines.
- Collections.
- Allocation and settlement.

## Color world

- Ink black.
- Graphite.
- Paper white.
- Soft steel gray.
- Ledger green only for confirmed money and primary completion.
- Muted amber only for items requiring attention.
- Muted red only for destructive actions or failed states.

No gradients. No decorative rainbow metrics. Use a borders-first depth system with quiet surface shifts.

## Signature component: Revenue Rail

Each engagement includes a horizontal financial rail. Its segments represent house participation, closer allocation, and delivery pool. Each segment contains the assigned person's avatar or initials. The rail must distinguish projection from approved settlement and explain the selected distributable base.

The same signature appears in:

1. Engagement list rows.
2. Engagement financial detail.
3. Founder finance dashboard.
4. Settlement approval dialog.
5. Leaderboard provenance view.

## Replace generic dashboard defaults

- Replace four disconnected KPI cards with one operational header combining approved money, pending money, active work, and the primary action.
- Replace a spreadsheet-style master table with a stage-based operations queue.
- Replace a wide SaaS sidebar with a compact rail that prioritizes Home, Operations, Leaderboard, and Admin.
- Replace decorative charts with actionable queues and exact amounts.

## Typography and spacing

- Use a distinctive grotesk or editorial sans suitable for FIRMA23, selected from locally available or properly licensed web fonts.
- Use tabular numerals for money.
- Use a 4px base spacing unit with primary layout intervals on an 8px rhythm.
- Keep radii restrained and consistent.
- Motion is quick deceleration, never bounce or spring.

## Required states

Every screen and data component needs loading, empty, error, disabled, focus, hover, and successful completion states. Mobile layouts must preserve the primary action and financial status without horizontal page scrolling.

