'use server';

import { activeSettlementRepository } from '@/data/repositories/active/settlements';
import { getViewer } from '@/data/viewer-session';
import type { ApproveSettlementInput, ApproveSettlementResult } from '@/types/views';

/** Resolves authority from the server session; the browser never supplies a viewer or money value. */
export async function approveSettlementAction(
  input: ApproveSettlementInput,
): Promise<ApproveSettlementResult> {
  const viewer = await getViewer();
  return activeSettlementRepository.approveSettlement(input, viewer);
}
