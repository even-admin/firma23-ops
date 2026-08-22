# M1 handoff: engineering complete, UI/UX polish next

Written 2026-08-21. Milestone M1 engineering is done and verified. This document is
for whoever picks up visual and interaction polish.

## What you are inheriting

A running Next.js 16 application with fourteen routes, three synthetic projects, and
no external dependencies. `npm install && npm run dev` is the whole setup. No
Supabase, no Vercel, no credentials, no environment variables.

```
npm run lint       0 problems
npm run typecheck  0 errors
npm test           200 passed
npm run build      succeeds, 14 routes
npm audit          0 vulnerabilities
```

## Your remit

Visual and interaction quality. The design direction in `docs/DESIGN-DIRECTION.md`
is the brief; the current UI satisfies it structurally but has had **no visual
review at any viewport**. Nobody has looked at this at 375px. That is the single
largest gap.

Specifically open for you:

- Typography scale, rhythm, and hierarchy across all routes.
- Density. `DESIGN-DIRECTION.md` asks for Whop-like density; the current spacing is
  conservative and probably too airy on the board and finance surfaces.
- The Revenue Rail's visual weight. It is the signature component and currently
  reads as five bordered boxes. It should read as a *rail*.
- Mobile layout at 375px. The tab bar and headers are built but unreviewed.
- Hover, focus, and transition polish. Tokens exist (`--ease-firma`, three
  durations); most components use them minimally.
- Empty and loading states are functional, not designed.

## Boundaries you should not cross

These are product invariants, not style choices. Breaking one is a correctness bug.

1. **Projected money must never read as approved or paid.** This is enforced by a
   discriminated union (`RailModel` in `src/lib/allocation.ts`) and by tests that
   assert the projected subtree contains **zero** elements with any `money` class.
   If you restyle and a test like that fails, the test is right.
2. **Ledger green (`--color-money`) is reserved** for confirmed money and primary
   completion. Amber for attention, red for destructive or failed. Nothing else is
   coloured.
3. **The leaderboard ranks on approved earnings only.** Projected is context.
4. **No gradients, no shadows** except the focus ring. Depth comes from borders.
5. **Tabular numerals on every amount.** Use the `Amount` component; do not render
   money as bare text.
6. **No hardcoded hex.** All colour lives in `src/app/tokens.css`. A grep for
   `#[0-9a-f]{6}` outside that file should stay empty.
7. **No project's financial rule in a component.** SETY's 30/20/50 exists only in
   `src/data/fixtures/projects/sety-2026/allocation-rule-versions.json`.
8. **Do not create external resources or deploy.** M1 stays local.

## Architecture you need to know

Three layers, enforced by ESLint, not convention:

```
src/app/**         Routes. May call repositories. May NOT import fixtures.
src/components/**  Presentational only. May NOT import from src/data/** at all.
src/data/**        Repository interfaces + synthetic implementations + fixtures.
src/lib/**         money, allocation, stats, viewer, cn. No React, no I/O.
src/types/views.ts View models: the shared contract between data and components.
```

If you need data in a component, add it to the view model and pass it as a prop.
The lint rule will stop you otherwise, and it is load-bearing: M2 swaps the
synthetic repositories for Supabase queries without touching the component tree.

Useful entry points:

| Thing | File |
|---|---|
| Design tokens | `src/app/tokens.css` |
| Base styles, `tnum`, `label-micro` | `src/app/globals.css` |
| All UI copy (es-MX) | `src/copy/es-MX.ts` |
| The Revenue Rail | `src/components/revenue-rail/` |
| The Operator Card | `src/components/operator/OperatorCard.tsx` |
| Operational header | `src/components/chrome/OperationalHeader.tsx` |
| Money formatting | `src/lib/money.ts` |
| **State gallery** | `/dev/states` — every component in every state |

Start at `/dev/states`. It renders every data component in every state on one page,
including the rail in all five variants, so you never have to contrive data to see
an empty, disabled, or error state. It returns 404 in a production build.

## Routes and how to see each state

Run `npm run dev`, then switch viewer with the control in the top bar. The
prototype viewer is a cookie; it grants nothing and disappears in M2.

| Route | Founder | Member |
|---|---|---|
| `/` | zero approved, `$1,794.54` projected, 2 approvals queued | `$1,794.54` approved, `$4,037.72` projected |
| `/opportunities` | 4 rails, filterable | permission denied |
| `/opportunities/[id]` | rail, milestones, evidence, ledger | permission denied |
| `/projects` | 3 projects, 2 different rules | same |
| `/projects/sety-2026` | 3 services, 30/20/50 rule | same |
| `/projects/ai-ops-retainer` | 25/25/50, different base policy | same |
| `/projects/even-internal-2026` | **genuinely empty** — draft, no services, no rules | same |
| `/network` | 6 operators, filterable | same |
| `/network/[slug]` | skills, portfolio, recent work | same |
| `/leaderboard` | ranked by approved; projected shown apart | same |
| `/leaderboard/[slug]/provenance` | every line traced to an approval | same |
| `/leaderboard/luis-ramirez/provenance` | **empty trace** — he approves, holds no line | same |
| `/admin`, `/admin/finance` | totals, per-opportunity rails, ledgers | permission denied |
| `/admin/finance/[id]/settle` | preview, approve control **disabled** | permission denied |

Interesting fixture states worth designing against:

- `SETY-0142` — in production, projected rail, milestones part-done.
- `SETY-0137` — approved settlement, two lines paid, three still owed.
- `SETY-0149` — delivered, one milestone **blocked**, awaiting settlement.
- `AIOPS-0007` — different project, different rule, **fully paid**.

## Things I deliberately left for you

1. **No visual review at any viewport.** Highest-priority item.
2. **`shadcn/ui` primitives are not installed.** `AGENTS.md` names them in the
   stack; I built the ~20 components M1 needed directly against the tokens instead
   of pulling in a primitive library that would then need restyling to match. If you
   want shadcn for dialogs, tooltips, or popovers as polish deepens, add it then —
   the token names in `tokens.css` are already shadcn-compatible semantic names.

   *Update, 2026-08-21:* the chrome rebuild increased the icon count, but the app
   still uses local stroke SVGs in `NavIcon` instead of adding an icon dependency.
3. **No animation beyond colour transitions.** Tokens are there; the motion design
   is not.
4. **`AssignmentRow` and `OperatorCard` are the two components most likely to need
   restructuring** for density. They are self-contained.
5. **The `detail` and `approval` rail variants only differ from `row` by layout and
   whether the base is spelled out.** They are the ones with the most room to become
   genuinely distinct.

## Two constraints that bit me and will bite you

**A `loading.tsx` above a dynamic route breaks 404 status codes.** Next flushes the
stream immediately, which locks the response at 200, so `notFound()` renders the
not-found UI with a 200. All loading UI therefore lives in `<Suspense>` boundaries
*inside* each index page, and there are no `loading.tsx` files in the `(network)`
group. If you add one, `/projects/nope` silently starts returning 200. Verify with:

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/projects/nope   # must be 404
```

**`next dev` rewrites `AGENTS.md`.** It appends its own instruction block to the
repository's governance file on every start. Disabled via `agentRules: false` in
`next.config.ts`. Do not remove that.

## Verification before you hand back

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Then check, at 375px, 768px, and 1280px:

- No horizontal page scroll anywhere.
- Primary action and money status visible on mobile.
- Every interactive element reachable by keyboard with a visible focus ring.
- Projected and approved rails unmistakably different at a glance.
- Switching to the member viewer produces the denied state on all four founder
  routes.

Heading structure is currently correct on all thirteen routes: exactly one `h1`, no
skipped levels. It is easy to break by changing a heading tag for visual reasons —
re-audit if you do.

## What comes after you

M2 (`docs/ARCHITECTURE.md`): the approved Supabase project
(`agsfxtbgwlkcwfyrykfo`, `us-east-1`, currently empty) gets migrations, seed, Auth,
and Row Level Security, and the synthetic repositories are replaced. The view models
in `src/types/views.ts` and the zod schemas in `src/data/schemas.ts` are written to
carry forward: the schemas become the row parsers.

M1 must not touch that project. Neither should polish work.
