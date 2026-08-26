# UI Home command strip handoff

## Objective

Replace Inicio's oversized active-project header with one compact personal identity
field and one truthful performance instrument. Keep `Siguientes pasos` and
`Mis asignaciones` structurally unchanged.

## Provenance

- Branch: `ui-integrator-merge-six-lanes`.
- Starting SHA: `f86c575af175b8bed1bbbc5cd4d0ce6a18cc47d4`.
- Delivery SHA: the local commit containing this handoff and implementation.
- Runtime dependencies added: none.
- Remote writes, push, PR, deploy, Vercel, Supabase and credentials: none.

## Product decisions

- The left field reuses the exact Home `MeshDriftCanvas`; it contains only member
  name, localized live CST time/date and a repository-derived active-work count.
- The right instrument combines the supplied stock tracker's metric/period model
  with the Progress Metric Card's line/event switch, floating readout and quiet
  summary footer. It rejects market language, demo data, fake percentages,
  Recharts and shadcn dependencies.
- Its visual adaptation follows the reference mechanics directly: 28px object
  radius, hairline edge, a 62% chart field, tokenized directional tint, masked
  14px dot grid, 2px curve and bars capped to the reference's narrow proportion.
  Event-bar mode is disabled when fewer than two real source events exist, so a
  sparse ledger never becomes one misleading oversized slab.
- `Ganado confirmado`, `Cobrado`, `Por cobrar` and `Cierres` replay dated,
  append-only source events. The balance curve connects only exact event balances;
  it does not create intermediate observations. Event mode exposes the signed
  source deltas directly.
- `Proyección` remains a current potential amount with no historical line because
  the present model has no authoritative dated projection events.
- Settlement reversals, signed payout corrections and stat reversals remain visible
  as correction/recovery event markers. Recovery never disappears into payable.
- Period controls use the repository snapshot boundary, so synthetic fixtures do
  not drift as the browser clock advances.

## Accessibility and responsive behavior

- Every period, metric, chart-mode and event-marker control is keyboard reachable
  and at least 44px.
- Focusing or hovering an event exposes date, exact value and source label in a
  compact polite readout on the plot.
- The desktop composition is approximately 35/65; below the desktop chamber it
  stacks identity first. Metric and period selection use neutral, unboxed controls;
  the view switch keeps a 28px visual target inside its 44px hit area, and there is
  no boxed tab footer.
- The line and area reveal once when the selected series changes. Reduced motion
  removes that reveal, while `MeshDriftCanvas` retains its existing frozen-frame
  behavior.

## Truth boundary

- Every visible amount renders through `Amount`.
- Projection carries no `money` class and never contributes to approved, paid or
  payable history.
- No percentage, delta, daily value or trend direction is invented.
- Source labels use repository-backed opportunity codes; components import no data.
- This is still synthetic presentation until Home receives a Supabase read adapter.

## Verification

Focused repository and component tests prove final-series reconciliation,
projection unavailability, signed close events, correction/recovery presentation,
metric/period switching and keyboard event detail. Full verification and exact
browser receipts are recorded in the delivery report after the tracked handoff is
committed.

At the local delivery checkpoint:

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass; the
  unit suite contains 400 passing tests.
- `bash scripts/db-verify.sh` passes all 153 database scenarios from zero on a
  disposable PostgreSQL 17 instance.
- Safari rendered the final neutral-control line view and the event-bar switch from
  `http://127.0.0.1:55131/` without horizontal overflow at its live desktop size.
  The advisory capture is ignored under
  `.context/dashboard-command-strip/home-safari-final.png`.
- Exact-width final-style captures at 375/767/768/1280 remain an Integrator browser
  gate; no unavailable viewport is represented as accepted evidence.
