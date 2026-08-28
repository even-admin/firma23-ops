import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CrewChangeHistory } from '@/components/opportunity/CrewChangeHistory';
import { copy } from '@/copy/es-MX';
import type { CrewChangeReceiptView } from '@/types/views';

const RECEIPT: CrewChangeReceiptView = {
  id: 'receipt-1',
  roleKey: 'delivery',
  createdAt: '2026-08-28T12:00:00.000Z',
  beforeAssignments: [
    { memberId: 'member-before', roleLabel: 'Producción', weightBp: 10_000 as never },
  ],
  afterAssignments: [
    { memberId: 'member-after', roleLabel: 'Producción principal', weightBp: 10_000 as never },
  ],
};

const poolLabels = new Map([['delivery', 'Producción']]);
const memberNames = new Map([
  ['member-before', 'Pablo Heisenberg'],
  ['member-after', 'Diego Martínez'],
]);

describe('CrewChangeHistory', () => {
  it('renders an honest empty state without inventing crew changes', () => {
    render(<CrewChangeHistory receipts={[]} poolLabels={poolLabels} memberNames={memberNames} />);

    expect(screen.getByRole('heading', { name: copy.detail.crew.history })).toBeInTheDocument();
    expect(screen.getByText(copy.detail.crew.historyEmpty)).toBeInTheDocument();
    expect(screen.queryByText('Pablo Heisenberg')).not.toBeInTheDocument();
  });

  it('reveals immutable before and after evidence under the actual pool label', () => {
    const { container } = render(
      <CrewChangeHistory receipts={[RECEIPT]} poolLabels={poolLabels} memberNames={memberNames} />,
    );

    const disclosure = container.querySelector('details');
    if (disclosure === null) throw new Error('crew receipt disclosure not found');
    const summary = disclosure.querySelector('summary');
    if (summary === null) throw new Error('crew receipt summary not found');

    fireEvent.click(summary);
    expect(screen.getByText(copy.detail.crew.previousCrew)).toBeInTheDocument();
    expect(screen.getByText(copy.detail.crew.replacementCrew)).toBeInTheDocument();
    expect(screen.getByText('Pablo Heisenberg')).toBeInTheDocument();
    expect(screen.getByText('Diego Martínez')).toBeInTheDocument();
    expect(screen.getByText('Producción principal')).toBeInTheDocument();
    expect(disclosure.open).toBe(true);
  });
});
