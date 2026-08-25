import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssignmentQueue } from '@/components/dashboard/AssignmentQueue';
import { NextActionQueue } from '@/components/dashboard/NextActionQueue';
import { copy } from '@/copy/es-MX';
import { money } from '@/lib/money';
import type { HomeAssignment, NextAction } from '@/types/views';

function nextAction(overrides: Partial<NextAction>): NextAction {
  return {
    key: 'action-1',
    label: 'Sube evidencia',
    detail: 'SETY-0142 · Beneficiario',
    tone: 'neutral',
    ...overrides,
  };
}

function assignment(overrides: Partial<HomeAssignment>): HomeAssignment {
  return {
    opportunityId: 'opp-1',
    code: 'SETY-0142',
    beneficiaryName: 'Beneficiario',
    beneficiaryLocation: 'Mérida',
    projectName: 'SETY 2026',
    serviceName: 'Identidad',
    roleLabel: 'Closer',
    status: 'in_delivery',
    active: true,
    money: { kind: 'projected', amount: money(0) },
    ...overrides,
  };
}

describe('NextActionQueue', () => {
  it('renders the empty state when there are no actions', () => {
    render(<NextActionQueue actions={[]} />);
    expect(screen.getByText(copy.home.noActions)).toBeInTheDocument();
  });

  it('ranks attention items before neutral items regardless of input order', () => {
    const actions = [
      nextAction({ key: 'evidence:1', label: 'Sube evidencia', tone: 'neutral' }),
      nextAction({ key: 'settle:1', label: 'Revisa liquidación', tone: 'attention' }),
      nextAction({ key: 'evidence:2', label: 'Sube evidencia 2', tone: 'neutral' }),
    ];

    render(<NextActionQueue actions={actions} />);

    const labels = screen.getAllByText(/Sube evidencia|Revisa liquidación/).map((el) => el.textContent);
    expect(labels[0]).toBe('Revisa liquidación');
  });

  it('numbers the queue starting from 01', () => {
    render(
      <NextActionQueue
        actions={[nextAction({ key: 'a' }), nextAction({ key: 'b', label: 'Otra acción' })]}
      />,
    );
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
  });
});

describe('AssignmentQueue', () => {
  it('renders the empty state when there are no assignments', () => {
    render(<AssignmentQueue assignments={[]} />);
    expect(screen.getByText(copy.home.noAssignments)).toBeInTheDocument();
    expect(screen.getByText(copy.home.noAssignmentsDetail)).toBeInTheDocument();
  });

  it('orders active assignments before settled/paid history', () => {
    const assignments = [
      assignment({
        opportunityId: 'settled',
        beneficiaryName: 'Historial SA',
        status: 'paid',
        active: false,
        money: { kind: 'approved', amount: money(100), payoutStatus: 'paid' },
      }),
      assignment({
        opportunityId: 'active',
        beneficiaryName: 'En curso SA',
        status: 'in_delivery',
        active: true,
      }),
    ];

    render(<AssignmentQueue assignments={assignments} />);

    const names = screen.getAllByText(/En curso SA|Historial SA/).map((el) => el.textContent);
    expect(names[0]).toBe('En curso SA');
    expect(names[1]).toBe('Historial SA');
  });

  it('never lets a projected assignment carry a money class', () => {
    render(
      <AssignmentQueue
        assignments={[
          assignment({
            money: { kind: 'projected', amount: money(500000) },
          }),
        ]}
      />,
    );
    expect(document.querySelectorAll('[class*="money"]')).toHaveLength(0);
  });
});
