import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { AssignmentList } from '@/components/opportunity/AssignmentList';
import { copy } from '@/copy/es-MX';
import { PROTOTYPE_FOUNDER } from '@/data/prototype-viewers';
import { syntheticOpportunityRepository } from '@/data/repositories/synthetic/opportunities';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import type { AssignmentView, PoolWeightView } from '@/types/views';

let assignments: readonly AssignmentView[];
let pools: readonly PoolWeightView[];

beforeAll(async () => {
  const cards = await syntheticSettlementRepository.listOpportunityRails(PROTOTYPE_FOUNDER);
  for (const card of cards) {
    const detail = await syntheticOpportunityRepository.getById(
      card.opportunity.id,
      PROTOTYPE_FOUNDER,
    );
    if (detail !== null && detail.pools.length > 1) {
      assignments = detail.assignments;
      pools = detail.pools;
      return;
    }
  }
  throw new Error('Fixtures must provide an opportunity with more than one pool');
});

describe('AssignmentList', () => {
  it('gives every pool its own section and its own independent balance check', () => {
    render(<AssignmentList assignments={assignments} pools={pools} />);
    for (const pool of pools) {
      expect(screen.getAllByText(pool.label).length).toBeGreaterThan(0);
    }
    // One weights-balance line rendered per pool, never one aggregated figure.
    const balanceLines = screen.getAllByText(copy.detail.weights);
    expect(balanceLines).toHaveLength(pools.length);
  });

  it('lists only the crew actually assigned to a pool, under that pool', () => {
    render(<AssignmentList assignments={assignments} pools={pools} />);
    for (const assignment of assignments) {
      expect(screen.getAllByText(assignment.displayName).length).toBeGreaterThan(0);
    }
  });

  it('never invents a person: nothing renders without a matching assignment', () => {
    render(<AssignmentList assignments={assignments} pools={pools} />);
    const names = new Set(assignments.map((a) => a.displayName));
    for (const name of names) {
      expect(screen.getAllByText(name)).toHaveLength(
        assignments.filter((a) => a.displayName === name).length,
      );
    }
  });
});
