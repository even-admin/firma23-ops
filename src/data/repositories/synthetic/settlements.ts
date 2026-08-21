import { assertFounder, type ViewerContext } from '@/lib/viewer';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { buildOpportunityRail } from '@/data/repositories/synthetic/rails';
import type { OpportunityRailCard, SettlementRepository } from '@/data/repositories/settlements';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import type { Opportunity } from '@/types/domain';

function toCard(dataset: SyntheticDataset, opportunity: Opportunity): OpportunityRailCard {
  const built = buildOpportunityRail(dataset, opportunity);
  return {
    opportunity: built.summary,
    rail: built.rail,
    distributableBase: built.distributableBase,
    cashReceived: built.cashReceived,
  };
}

export const syntheticSettlementRepository: SettlementRepository = {
  async listOpportunityRails(viewer: ViewerContext): Promise<OpportunityRailCard[]> {
    assertFounder(viewer, 'listOpportunityRails');
    const dataset = loadSyntheticDataset();
    return dataset.opportunities.map((opportunity) => toCard(dataset, opportunity));
  },

  async getOpportunityRail(
    opportunityId: string,
    viewer: ViewerContext,
  ): Promise<OpportunityRailCard | null> {
    assertFounder(viewer, 'getOpportunityRail');
    const dataset = loadSyntheticDataset();
    const opportunity = dataset.opportunities.find((entry) => entry.id === opportunityId);
    if (opportunity === undefined) return null;
    return toCard(dataset, opportunity);
  },
};
