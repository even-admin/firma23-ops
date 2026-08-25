import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { OpportunityRow } from '@/components/opportunity/OpportunityRow';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import type { OpportunityRailCard } from '@/data/repositories/settlements';

let card: OpportunityRailCard;

beforeAll(async () => {
  const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
  const first = cards[0];
  if (first === undefined) throw new Error('Fixtures must provide at least one opportunity');
  card = first;
});

function row(overrides: Partial<Parameters<typeof OpportunityRow>[0]> = {}) {
  return (
    <OpportunityRow
      id={card.opportunity.id}
      code={card.opportunity.code}
      beneficiaryName={card.opportunity.beneficiaryName}
      beneficiaryLocation={card.opportunity.beneficiaryLocation}
      projectName={card.opportunity.projectName}
      serviceName={card.opportunity.serviceName}
      serviceVersion={card.opportunity.serviceVersion}
      status={card.opportunity.status}
      rail={card.rail}
      base={card.distributableBase.base}
      basePolicyLabel={card.distributableBase.policyLabel}
      basePolicyNote={card.distributableBase.policyNote}
      cashReceived={card.cashReceived}
      {...overrides}
    />
  );
}

describe('OpportunityRow', () => {
  it('links the beneficiary name to its exact detail route', () => {
    render(row());
    expect(screen.getByRole('link', { name: card.opportunity.beneficiaryName })).toHaveAttribute(
      'href',
      `/opportunities/${card.opportunity.id}`,
    );
  });

  it('identifies the opportunity densely: code, location, project and service in one line', () => {
    render(row());
    const line = screen.getByText(
      new RegExp(
        `${card.opportunity.code}.*${card.opportunity.beneficiaryLocation}.*${card.opportunity.projectName}.*${card.opportunity.serviceName}`,
      ),
    );
    expect(line).toBeInTheDocument();
  });

  it('shows the real status pill, not a free-text label', () => {
    render(row());
    expect(
      screen.getByText(copy.opportunity.statusLabels[card.opportunity.status]),
    ).toBeInTheDocument();
  });

  it('always renders the base explainer distinguishing base from cash received', () => {
    render(row());
    expect(screen.getByText(copy.money.base)).toBeInTheDocument();
    expect(screen.getByText(copy.money.cashReceived)).toBeInTheDocument();
  });

  it('renders the revenue rail in its dense row variant', () => {
    const { container } = render(row());
    expect(container.querySelector('[data-variant="row"]')).not.toBeNull();
  });

  it('is a single article landmark, not nested decorative cards', () => {
    const { container } = render(row());
    expect(container.querySelectorAll('article')).toHaveLength(1);
  });
});
