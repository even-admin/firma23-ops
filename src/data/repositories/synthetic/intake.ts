import { copy } from '@/copy/es-MX';
import { resolveAllocation } from '@/lib/allocation';
import { formatBasisPoints, type Money } from '@/lib/money';
import { DataError } from '@/lib/result';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type {
  ConfirmContractDraftInput,
  ConfirmContractDraftResult,
  DiscardContractDraftResult,
  IntakeRepository,
  ManualContractSetupInput,
  ManualContractSetupResult,
  RunIntakeInput,
} from '@/data/repositories/intake';
import { SOURCE_DOCUMENT_KIND_LABELS } from '@/data/repositories/shared/intake-labels';
import { loadSyntheticDataset } from '@/data/repositories/synthetic/dataset';
import type {
  ContractDraftView,
  DraftAssignmentSuggestionView,
  DraftFieldView,
  DraftMilestoneView,
  DraftServiceView,
  ExtractionConfidence,
  IntakeRunView,
  ReviewIssueView,
} from '@/types/views';

/** Least confident field wins, so the overall label never overstates a draft. */
function overallConfidence(entries: readonly ExtractionConfidence[]): ExtractionConfidence {
  if (entries.includes('low')) return 'low';
  if (entries.includes('medium')) return 'medium';
  return 'high';
}

export const syntheticIntakeRepository: IntakeRepository = {
  async runIntake(_input: RunIntakeInput, viewer: ViewerContext): Promise<IntakeRunView> {
    assertFounder(viewer, 'runIntake');
    const dataset = loadSyntheticDataset();

    const draftRecord = [...dataset.aiContractDrafts.values()][0];
    if (draftRecord === undefined) {
      throw new DataError('No AI contract draft fixture is available');
    }
    const sourceDocument = dataset.sourceDocuments.get(draftRecord.sourceDocumentId);
    if (sourceDocument === undefined) {
      throw new DataError(`Draft ${draftRecord.id} references a missing source document`);
    }

    const matchedProject =
      draftRecord.matchedProjectId === null
        ? undefined
        : dataset.projects.get(draftRecord.matchedProjectId);

    const services: DraftServiceView[] = draftRecord.matchedServiceVersionIds.map((serviceId) => {
      const service = dataset.serviceVersions.get(serviceId);
      if (service === undefined) {
        throw new DataError(`Draft ${draftRecord.id} references missing service ${serviceId}`);
      }
      return {
        name: service.name,
        version: service.version,
        deliverablesSummary: service.deliverablesSummary,
        milestoneCount: dataset.milestoneTemplates.filter(
          (template) => template.serviceVersionId === serviceId,
        ).length,
      };
    });

    const milestones: DraftMilestoneView[] = draftRecord.matchedServiceVersionIds.flatMap(
      (serviceId) => {
        const service = dataset.serviceVersions.get(serviceId);
        return dataset.milestoneTemplates
          .filter((template) => template.serviceVersionId === serviceId)
          .map((template) => ({
            position: template.position,
            name: template.name,
            description: template.description,
            serviceName: service?.name ?? '',
          }));
      },
    );

    const ruleVersion =
      draftRecord.matchedAllocationRuleVersionId === null
        ? undefined
        : dataset.allocationRuleVersions.get(draftRecord.matchedAllocationRuleVersionId);
    if (ruleVersion === undefined) {
      throw new DataError(`Draft ${draftRecord.id} references a missing allocation rule version`);
    }

    const exampleBase: Money = draftRecord.exampleDistributableBase.value;

    const projectedAllocation = resolveAllocation({
      ruleVersion,
      base: exampleBase,
      basePolicyLabel: ruleVersion.basePolicy.label,
      // No opportunity or beneficiary exists yet, so nobody can be assigned.
      assignments: [],
      members: dataset.members,
      organizations: dataset.organizations,
      unassignedLabel: copy.money.unassigned,
    });

    const assignments: DraftAssignmentSuggestionView[] = draftRecord.suggestedAssignments.map(
      (suggestion) => {
        const share = ruleVersion.shares.find((candidate) => candidate.key === suggestion.roleKey);
        if (share === undefined) {
          throw new DataError(`No allocation share matches suggested role ${suggestion.roleKey}`);
        }
        return {
          roleLabel: share.label,
          shareOfBaseLabel: formatBasisPoints(share.weightBp),
          rationale: suggestion.rationale,
          confidence: suggestion.confidence,
        };
      },
    );

    const reviewIssues: ReviewIssueView[] = draftRecord.reviewIssues.map((issue) => ({
      severity: issue.severity,
      fieldLabel: issue.fieldLabel,
      detail: issue.detail,
    }));

    const fields: DraftFieldView[] = [
      {
        label: 'Patrocinador',
        value: draftRecord.sponsorName.value,
        confidence: draftRecord.sponsorName.confidence,
        evidence: draftRecord.sponsorName.evidence,
      },
      {
        label: 'Programa',
        value: draftRecord.programName.value,
        confidence: draftRecord.programName.confidence,
        evidence: draftRecord.programName.evidence,
      },
    ];

    const draft: ContractDraftView = {
      id: draftRecord.id,
      origin: 'ai_extracted',
      sponsorName: draftRecord.sponsorName.value,
      programName: draftRecord.programName.value,
      sourceDocumentName: sourceDocument.filename,
      sourceDocumentKindLabel: SOURCE_DOCUMENT_KIND_LABELS[sourceDocument.kind],
      extractedAt: draftRecord.extractedAt,
      matchedProjectName: matchedProject?.name ?? null,
      matchedProjectSlug: matchedProject?.slug ?? null,
      fields,
      services,
      milestones,
      assignments,
      projectedAllocation,
      projectedAllocationNote: draftRecord.exampleDistributableBaseNote,
      reviewIssues,
      confidenceOverall: overallConfidence([
        draftRecord.sponsorName.confidence,
        draftRecord.programName.confidence,
        draftRecord.exampleDistributableBase.confidence,
        ...draftRecord.suggestedAssignments.map((suggestion) => suggestion.confidence),
      ]),
    };

    return {
      id: `run-${draftRecord.id}`,
      status: 'ready',
      sourceDocumentName: sourceDocument.filename,
      draft,
      errorMessage: null,
      synthetic: true,
    };
  },

  async confirmContractDraft(
    _input: ConfirmContractDraftInput,
    viewer: ViewerContext,
  ): Promise<ConfirmContractDraftResult> {
    assertFounder(viewer, 'confirmContractDraft');
    // M1/the local adapter has no write path at all, the same as
    // syntheticFinanceRepository's settlement preview. Saying so plainly is
    // more honest than a control that quietly does nothing. The real
    // implementation lives in the Supabase adapter and is exercised there.
    return { kind: 'unavailable', reason: copy.admin.intake.confirmBlockedReason };
  },

  async discardContractDraft(
    _draftId: string,
    viewer: ViewerContext,
  ): Promise<DiscardContractDraftResult> {
    assertFounder(viewer, 'discardContractDraft');
    return { kind: 'unavailable', reason: copy.admin.intake.confirmBlockedReason };
  },

  async createManualContractSetup(
    _input: ManualContractSetupInput,
    viewer: ViewerContext,
  ): Promise<ManualContractSetupResult> {
    assertFounder(viewer, 'createManualContractSetup');
    return { kind: 'unavailable', reason: copy.admin.intake.confirmBlockedReason };
  },
};
