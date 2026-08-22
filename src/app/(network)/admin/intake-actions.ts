'use server';

import { activeIntakeRepository } from '@/data/repositories/active/intake';
import { getPrototypeViewer } from '@/data/prototype-viewer-session';
import type {
  ConfirmContractDraftInput,
  ConfirmContractDraftResult,
  DiscardContractDraftResult,
  RunIntakeInput,
} from '@/data/repositories/intake';
import type { IntakeRunView } from '@/types/views';

export async function runIntakeAction(input: RunIntakeInput): Promise<IntakeRunView> {
  const viewer = await getPrototypeViewer();
  return activeIntakeRepository.runIntake(input, viewer);
}

/**
 * Server Actions for the founder confirmation boundary.
 *
 * Each resolves the viewer itself rather than trusting a viewer object
 * passed from the client — the prototype cookie session is server-only, and
 * in M2 this is exactly where the real authenticated session would be read.
 * The active repository (src/data/repositories/active/intake.ts) decides
 * synthetic vs. Supabase; this file never chooses between them itself.
 */

export async function confirmContractDraftAction(
  input: ConfirmContractDraftInput,
): Promise<ConfirmContractDraftResult> {
  const viewer = await getPrototypeViewer();
  return activeIntakeRepository.confirmContractDraft(input, viewer);
}

export async function discardContractDraftAction(
  draftId: string,
): Promise<DiscardContractDraftResult> {
  const viewer = await getPrototypeViewer();
  return activeIntakeRepository.discardContractDraft(draftId, viewer);
}
