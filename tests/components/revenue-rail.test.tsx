import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { Amount } from '@/components/money/Amount';
import { RailStateBadge } from '@/components/revenue-rail/RailStateBadge';
import { RevenueRail } from '@/components/revenue-rail/RevenueRail';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import type { OpportunityRailCard } from '@/data/repositories/settlements';
import type {
  AllocationProjection,
  ApprovedSettlement,
  CorrectionRequired,
} from '@/lib/allocation';
import { money } from '@/lib/money';

let projected: AllocationProjection;
let settled: ApprovedSettlement;

beforeAll(async () => {
  const cards: OpportunityRailCard[] =
    await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
  const projectedCard = cards.find((card) => card.rail.kind === 'projection');
  const settledCard = cards.find((card) => card.rail.kind === 'settlement');
  if (projectedCard?.rail.kind !== 'projection' || settledCard?.rail.kind !== 'settlement') {
    throw new Error('Fixtures must provide one projected and one settled rail');
  }
  projected = projectedCard.rail;
  settled = settledCard.rail;
});

describe('Amount', () => {
  it('formats money with tabular numerals and keeps minor units machine-readable', () => {
    render(<Amount value={money(897_270)} />);
    const node = screen.getByText('$8,972.70');
    expect(node).toHaveClass('tnum');
    expect(node).toHaveAttribute('value', '897270');
  });

  it('never emits a bare unformatted number', () => {
    const { container } = render(<Amount value={money(897_270)} />);
    expect(container.textContent).not.toBe('897270');
  });
});

describe('RailStateBadge', () => {
  it('withholds the ledger colour from projected money', () => {
    const { container } = render(<RailStateBadge state="projected" />);
    expect(container.querySelectorAll('[class*="money"]')).toHaveLength(0);
    expect(screen.getByText(copy.money.projected)).toBeInTheDocument();
  });

  it('uses the ledger colour for approved and paid money', () => {
    const approved = render(<RailStateBadge state="approved" />);
    expect(approved.container.querySelectorAll('[class*="money"]').length).toBeGreaterThan(0);
    const paid = render(<RailStateBadge state="paid" />);
    expect(paid.container.querySelectorAll('[class*="money"]').length).toBeGreaterThan(0);
  });
});

describe('RevenueRail, projected', () => {
  it('labels itself a projection', () => {
    render(<RevenueRail model={projected} />);
    expect(screen.getByText(copy.money.projected)).toBeInTheDocument();
    expect(screen.getByText(copy.money.projectedLong)).toBeInTheDocument();
  });

  it('never says approved or paid', () => {
    render(<RevenueRail model={projected} />);
    expect(screen.queryByText(copy.money.approved)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.money.paid)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(copy.money.approvedBy))).not.toBeInTheDocument();
  });

  it('carries no ledger colour anywhere in the subtree', () => {
    const { container } = render(<RevenueRail model={projected} />);
    expect(container.querySelectorAll('[class*="money"]')).toHaveLength(0);
  });

  it('announces itself as an unapproved projection to assistive technology', () => {
    render(<RevenueRail model={projected} />);
    expect(screen.getByLabelText(copy.rail.projectionAria)).toBeInTheDocument();
  });

  it('renders the confirmed SETY share amounts', () => {
    render(<RevenueRail model={projected} />);
    // House: segment total plus its single recipient.
    expect(screen.getAllByText('$2,691.81')).toHaveLength(2);
    // Closer: segment total, the closer, and coincidentally the top delivery share.
    expect(screen.getAllByText('$1,794.54')).toHaveLength(3);
    // Delivery: the pool total only; its members each hold a different amount.
    expect(screen.getAllByText('$4,486.35')).toHaveLength(1);
  });

  it('shows each delivery contributor with initials and amount', () => {
    render(<RevenueRail model={projected} />);
    expect(screen.getByText('Emiliano Pasos')).toBeInTheDocument();
    expect(screen.getByText('Pablo Heisenberg')).toBeInTheDocument();
    expect(screen.getByText('Diego Martínez Hernández')).toBeInTheDocument();
    expect(screen.getByText('$1,570.22')).toBeInTheDocument();
    expect(screen.getByText('$1,121.59')).toBeInTheDocument();
  });

  it('attributes the house share to its organization, not a person', () => {
    render(<RevenueRail model={projected} />);
    expect(screen.getByText('EVEN')).toBeInTheDocument();
  });
});

describe('RevenueRail, approved', () => {
  it('labels itself approved and names the approver', () => {
    render(<RevenueRail model={settled} />);
    expect(screen.getAllByText(copy.money.approved).length).toBeGreaterThan(0);
    expect(screen.getByText(`${copy.money.approvedBy} Luis Ramírez`)).toBeInTheDocument();
  });

  it('never says projection', () => {
    render(<RevenueRail model={settled} />);
    expect(screen.queryByText(copy.money.projected)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.money.projectedLong)).not.toBeInTheDocument();
  });

  it('separates paid from unpaid inside approved money', () => {
    render(<RevenueRail model={settled} />);
    expect(screen.getByText(`${copy.money.paid}:`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`${copy.money.unpaid}:`, { exact: false })).toBeInTheDocument();
    // Two paid lines, three still owed: $4,486.35 on each side.
    expect(screen.getAllByText('$4,486.35')).toHaveLength(3);
  });

  it('marks only the two settled lines as paid, leaving delivery owed', () => {
    render(<RevenueRail model={settled} />);
    // Exactly two paid badges: house and closer. The three delivery lines are approved but unpaid.
    expect(screen.getAllByText(copy.money.paid)).toHaveLength(2);
    expect(screen.getAllByText(copy.money.approved)).toHaveLength(4);
  });

  it('announces itself as an approved settlement to assistive technology', () => {
    render(<RevenueRail model={settled} />);
    expect(screen.getByLabelText(copy.rail.settlementAria)).toBeInTheDocument();
  });

  it('exposes the rail kind for downstream variants', () => {
    const { container } = render(<RevenueRail model={settled} variant="row" />);
    expect(container.querySelector('[data-rail-kind="settlement"]')).not.toBeNull();
    expect(container.querySelector('[data-variant="row"]')).not.toBeNull();
  });
});

describe('RevenueRail, correction required', () => {
  const correction: CorrectionRequired = {
    kind: 'correction_required',
    reversedSettlementId: 'settlement-original',
    reversalSettlementId: 'settlement-reversal',
    ruleVersionId: 'rule-1',
    ruleVersion: 1,
    reversedAt: '2026-08-25T00:00:00.000Z',
  };

  it('renders an attention state without projection, approval, or money', () => {
    const { container } = render(<RevenueRail model={correction} />);
    expect(screen.getByLabelText(copy.rail.correctionAria)).toBeInTheDocument();
    expect(screen.getByText(copy.rail.correctionRequired)).toBeInTheDocument();
    expect(screen.queryByText(copy.money.projected)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.money.approved)).not.toBeInTheDocument();
    expect(container.querySelector('data.tnum')).toBeNull();
    expect(container.querySelectorAll('[class*="money"]')).toHaveLength(0);
  });
});
