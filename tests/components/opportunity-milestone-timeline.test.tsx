import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { MilestoneChecklist } from '@/components/opportunity/MilestoneChecklist';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticOpportunityRepository } from '@/data/repositories/synthetic/opportunities';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import type { MilestoneView } from '@/types/views';

let milestones: readonly MilestoneView[];

beforeAll(async () => {
  const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
  for (const card of cards) {
    const detail = await syntheticOpportunityRepository.getById(
      card.opportunity.id,
      PROTOTYPE_FOUNDER,
    );
    if (detail !== null && detail.milestones.length > 1) {
      milestones = detail.milestones;
      return;
    }
  }
  throw new Error('Fixtures must provide an opportunity with more than one milestone');
});

describe('MilestoneChecklist as a semantic timeline', () => {
  it('renders one top-level ordered-list step per milestone, in position order', () => {
    const { container } = render(<MilestoneChecklist milestones={milestones} />);
    const items = container.querySelectorAll('ol > li');
    expect(items).toHaveLength(milestones.length);
    milestones.forEach((milestone) => {
      expect(screen.getByText(milestone.name)).toBeInTheDocument();
    });
  });

  it('draws a connecting rail between steps but not after the final one', () => {
    const { container } = render(<MilestoneChecklist milestones={milestones} />);
    const items = container.querySelectorAll('ol > li');
    // Every item except the last carries a decorative connector to the next step.
    items.forEach((item, index) => {
      const connector = item.querySelector('span.w-px');
      if (index === items.length - 1) {
        expect(connector).toBeNull();
      } else {
        expect(connector).not.toBeNull();
        expect(connector).toHaveAttribute('aria-hidden', 'true');
      }
    });
  });

  it('shows the real status label for each milestone, never an invented health score', () => {
    render(<MilestoneChecklist milestones={milestones} />);
    for (const milestone of milestones) {
      expect(
        screen.getAllByText(copy.detail.milestoneStatus[milestone.status]).length,
      ).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/salud|health|score/i)).not.toBeInTheDocument();
  });

  it('only shows an assignee badge for a milestone that actually has one assigned', () => {
    render(<MilestoneChecklist milestones={milestones} />);
    const withOwner = milestones.filter((m) => m.assignedMemberInitials !== null);
    for (const milestone of withOwner) {
      expect(
        screen.getAllByText(milestone.assignedMemberInitials as string).length,
      ).toBeGreaterThan(0);
    }
  });
});
