# UI-ADMIN shared request

Status: non-blocking. UI-ADMIN shipped a working local substitute; this
requests Integrator centralize four label strings into the owned shared copy
file when convenient.

## Current behavior

The Admin document-intake flow (`/admin`, `DocumentIntakePanel` and its
children) now renders a truthful four-step progress indicator over the
Documento → Extracción → Revisión → Confirmación phases named in
`docs/UI-REFERENCE-CATALOG.md` ("Registration Stepper" adaptation). Every
other string in `src/components/admin/**` is sourced from
`copy.admin.intake` in `src/copy/es-MX.ts`, but `src/copy/es-MX.ts` is an
Integrator-owned shared surface (`docs/UI-WORKSPACE-LAUNCH-PLAN.md` ownership
matrix) that UI-ADMIN may not edit. No existing key in `copy.admin.intake`
carries these four exact phase names or the stepper's `aria-label`.

To ship without crossing that ownership boundary, the four labels and the
stepper's group `aria-label` are defined locally in
`src/components/admin/IntakeStepper.tsx` (see the comment above
`STEP_LABELS`), not in `src/copy/es-MX.ts`. Functionally this is complete —
the stepper's four statuses are derived entirely from real phase/result
state (never a timer or decorative animation) — this request is only about
where the four literal strings live.

## Requested contract

Add to `src/copy/es-MX.ts`, nested under `admin.intake` (e.g.
`admin.intake.stepper`):

```ts
stepper: {
  ariaLabel: 'Progreso de la propuesta',
  document: 'Documento',
  extraction: 'Extracción',
  review: 'Revisión',
  confirmation: 'Confirmación',
},
```

If accepted, `src/components/admin/IntakeStepper.tsx` should switch from its
local `STEP_LABELS`/`STEPPER_LABEL` constants to `copy.admin.intake.stepper`.
That follow-up edit is Integrator's call to make or to hand back, since the
file is otherwise UI-ADMIN-owned presentation.

## Affected routes

`/admin` only (`DocumentIntakePanel` → `IntakeStepper`).

## Acceptance evidence

- `npm run lint`, `npm run typecheck`, `npm test` all pass with the local
  constants in place (see `docs/ui-handoffs/UI-ADMIN.md`).
- New tests in `tests/components/admin-intake-stepper.test.tsx` assert the
  four labels render and that exactly one step carries `aria-current="step"`
  at a time, matching real phase transitions.

## Blocked?

No. This is a quality-of-organization request, not a functional blocker.
UI-ADMIN's document-first command center works fully today with the local
constants.

## Money/permission impact

None. These are display labels for an already-founder-gated, already
non-mutating intake flow. No financial rule, projection semantics, or
authorization logic is affected.
