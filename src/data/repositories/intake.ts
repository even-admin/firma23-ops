import type { ViewerContext } from '@/lib/viewer';
import type {
  ConfirmContractDraftInput,
  ConfirmContractDraftResult,
  DiscardContractDraftResult,
  IntakeRunView,
  ManualContractSetupInput,
  ManualContractSetupResult,
  RunIntakeInput,
} from '@/types/views';

export type {
  ConfirmContractDraftInput,
  ConfirmContractDraftResult,
  DiscardContractDraftResult,
  ManualContractSetupInput,
  ManualContractSetupResult,
  RunIntakeInput,
};

export interface IntakeRepository {
  /**
   * Founder-only. Runs the intake adapter (local deterministic today; a live
   * AI provider behind the same contract once one is configured — see
   * src/lib/ai/provider.ts) against the founder's upload and returns the
   * resulting draft.
   */
  runIntake(input: RunIntakeInput, viewer: ViewerContext): Promise<IntakeRunView>;

  /** Founder-only. The authority boundary: draft -> canonical project. */
  confirmContractDraft(
    input: ConfirmContractDraftInput,
    viewer: ViewerContext,
  ): Promise<ConfirmContractDraftResult>;

  /** Founder-only. The explicit rejection path for a draft that is wrong. */
  discardContractDraft(draftId: string, viewer: ViewerContext): Promise<DiscardContractDraftResult>;

  /** Founder-only complete manual V1 setup, persisted atomically in Supabase. */
  createManualContractSetup(
    input: ManualContractSetupInput,
    viewer: ViewerContext,
  ): Promise<ManualContractSetupResult>;
}
