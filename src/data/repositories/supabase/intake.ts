/**
 * Supabase-backed intake repository.
 *
 * Satisfies the exact same IntakeRepository interface the synthetic adapter
 * does. Every write goes through a SECURITY DEFINER Postgres function
 * (run_intake, confirm_contract_draft, discard_contract_draft — see
 * supabase/migrations/20260821090400_intake_and_audit.sql) rather than a
 * direct table write, so the founder-authority boundary is enforced in
 * Postgres even if this adapter had a bug.
 *
 * This file has never run against a live project: the development project
 * agsfxtbgwlkcwfyrykfo is not reachable from this environment (see the
 * session handoff for why). Every migration and RPC it calls was verified
 * against a local, throwaway Postgres 17 instance instead. It compiles and
 * type-checks against the frozen IntakeRepository contract, which is what
 * "prepare the backend foundation" means until that project is reachable.
 */

import { resolveAllocation } from '@/lib/allocation';
import { formatBasisPoints, money, type Money } from '@/lib/money';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type {
  ConfirmContractDraftInput,
  ConfirmContractDraftResult,
  DiscardContractDraftResult,
  IntakeRepository,
  RunIntakeInput,
} from '@/data/repositories/intake';
import {
  guessSourceDocumentKind,
  SOURCE_DOCUMENT_KIND_LABELS,
} from '@/data/repositories/shared/intake-labels';
import { copy } from '@/copy/es-MX';
import type {
  AllocationRecipientBehavior,
  AssignmentRoleKey,
  SourceDocumentKind,
} from '@/types/domain';
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

interface ExtractedFieldRow<T> {
  readonly value: T;
  readonly confidence: ExtractionConfidence;
  readonly evidence: readonly { readonly locationLabel: string; readonly quote: string }[];
}

interface AiContractDraftRow {
  readonly id: string;
  readonly source_document_id: string;
  readonly matched_project_id: string | null;
  readonly matched_service_version_ids: readonly string[];
  readonly matched_allocation_rule_version_id: string | null;
  readonly extracted_at: string;
  readonly sponsor_name: ExtractedFieldRow<string>;
  readonly program_name: ExtractedFieldRow<string>;
  readonly example_distributable_base: ExtractedFieldRow<{
    readonly amountCentavos: number;
    readonly currency: 'MXN';
  }>;
  readonly example_distributable_base_note: string;
  readonly review_issues: readonly {
    readonly severity: 'missing' | 'ambiguous';
    readonly fieldLabel: string;
    readonly detail: string;
  }[];
  readonly suggested_assignments: readonly {
    readonly roleKey: AssignmentRoleKey;
    readonly rationale: string;
    readonly confidence: ExtractionConfidence;
  }[];
}

function overallConfidence(entries: readonly ExtractionConfidence[]): ExtractionConfidence {
  if (entries.includes('low')) return 'low';
  if (entries.includes('medium')) return 'medium';
  return 'high';
}

/** Least-privilege lookup: resolves or registers document metadata only —
 * never uploads binary content, since that goes through Supabase Storage's
 * own signed-URL flow, not this repository. */
async function resolveSourceDocumentId(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  orgId: string,
  viewerId: string,
  filename: string,
): Promise<string> {
  const existing = await client
    .from('source_documents')
    .select('id')
    .eq('org_id', orgId)
    .eq('filename', filename)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data !== null) return existing.data.id as string;

  const inserted = await client
    .from('source_documents')
    .insert({
      org_id: orgId,
      uploaded_by_member_id: viewerId,
      filename,
      kind: guessSourceDocumentKind(filename),
    })
    .select('id')
    .single();

  if (inserted.error !== null || inserted.data === null) {
    throw new Error(inserted.error?.message ?? 'Failed to register source document');
  }
  return inserted.data.id as string;
}

async function buildDraftView(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  draftId: string,
): Promise<ContractDraftView> {
  const draftResult = await client
    .from('ai_contract_drafts')
    .select('*')
    .eq('id', draftId)
    .single();

  if (draftResult.error !== null || draftResult.data === null) {
    throw new Error(draftResult.error?.message ?? `Draft ${draftId} not found`);
  }
  const draft = draftResult.data as AiContractDraftRow;

  const [sourceDocResult, matchedProjectResult, serviceVersionsResult, ruleVersionResult] =
    await Promise.all([
      client.from('source_documents').select('filename, kind').eq('id', draft.source_document_id).single(),
      draft.matched_project_id === null
        ? Promise.resolve({ data: null })
        : client.from('projects').select('name, slug').eq('id', draft.matched_project_id).single(),
      draft.matched_service_version_ids.length === 0
        ? Promise.resolve({ data: [] })
        : client
            .from('service_versions')
            .select('id, name, version, deliverables_summary')
            .in('id', draft.matched_service_version_ids),
      draft.matched_allocation_rule_version_id === null
        ? Promise.resolve({ data: null })
        : client
            .from('allocation_rule_versions')
            .select(
              'id, version, base_policy, allocation_shares(key, recipient_behavior, label, weight_bp, recipient_org_id)',
            )
            .eq('id', draft.matched_allocation_rule_version_id)
            .single(),
    ]);

  const sourceDocument = sourceDocResult.data as { filename: string; kind: SourceDocumentKind } | null;
  if (sourceDocument === null) {
    throw new Error(`Draft ${draftId} references a missing source document`);
  }

  const matchedProject = matchedProjectResult.data as { name: string; slug: string } | null;

  const serviceVersionRows = (serviceVersionsResult.data ?? []) as readonly {
    id: string;
    name: string;
    version: number;
    deliverables_summary: string;
  }[];

  const milestoneTemplatesResult =
    draft.matched_service_version_ids.length === 0
      ? { data: [] }
      : await client
          .from('milestone_templates')
          .select('service_version_id, position, name, description')
          .in('service_version_id', draft.matched_service_version_ids)
          .order('position', { ascending: true });

  const milestoneTemplateRows = (milestoneTemplatesResult.data ?? []) as readonly {
    service_version_id: string;
    position: number;
    name: string;
    description: string;
  }[];

  const serviceNameById = new Map(serviceVersionRows.map((row) => [row.id, row.name]));

  const services: DraftServiceView[] = serviceVersionRows.map((row) => ({
    name: row.name,
    version: row.version,
    deliverablesSummary: row.deliverables_summary,
    milestoneCount: milestoneTemplateRows.filter((m) => m.service_version_id === row.id).length,
  }));

  const milestones: DraftMilestoneView[] = milestoneTemplateRows.map((row) => ({
    position: row.position,
    name: row.name,
    description: row.description,
    serviceName: serviceNameById.get(row.service_version_id) ?? '',
  }));

  const fields: DraftFieldView[] = [
    {
      label: 'Patrocinador',
      value: draft.sponsor_name.value,
      confidence: draft.sponsor_name.confidence,
      evidence: draft.sponsor_name.evidence,
    },
    {
      label: 'Programa',
      value: draft.program_name.value,
      confidence: draft.program_name.confidence,
      evidence: draft.program_name.evidence,
    },
  ];

  const reviewIssues: ReviewIssueView[] = draft.review_issues.map((issue) => ({
    severity: issue.severity,
    fieldLabel: issue.fieldLabel,
    detail: issue.detail,
  }));

  let projectedAllocation: ContractDraftView['projectedAllocation'] = null;
  let assignments: readonly DraftAssignmentSuggestionView[] = [];

  const ruleVersionRow = ruleVersionResult.data as {
    id: string;
    version: number;
    base_policy: { label: string };
    allocation_shares: readonly {
      key: string;
      recipient_behavior: AllocationRecipientBehavior;
      label: string;
      weight_bp: number;
      recipient_org_id: string | null;
    }[];
  } | null;

  if (ruleVersionRow !== null) {
    const exampleBase: Money = money(
      draft.example_distributable_base.value.amountCentavos,
      draft.example_distributable_base.value.currency,
    );

    // organizations map is only needed to resolve the house share's display
    // name; fetch just the referenced org(s) rather than the whole table.
    const houseOrgIds = ruleVersionRow.allocation_shares
      .filter((share) => share.recipient_behavior === 'org_recipient' && share.recipient_org_id !== null)
      .map((share) => share.recipient_org_id as string);
    const orgsResult =
      houseOrgIds.length === 0
        ? { data: [] }
        : await client.from('organizations').select('id, name').in('id', houseOrgIds);
    const organizations = new Map(
      ((orgsResult.data ?? []) as readonly { id: string; name: string }[]).map((o) => [
        o.id,
        { id: o.id, slug: o.id, name: o.name },
      ]),
    );

    projectedAllocation = resolveAllocation({
      ruleVersion: {
        id: ruleVersionRow.id,
        projectId: draft.matched_project_id ?? '',
        version: ruleVersionRow.version,
        effectiveFrom: draft.extracted_at,
        currency: 'MXN',
        immutable: true,
        basePolicy: { kind: 'cash_event_types', includeTypes: ['deposit'], label: '', note: '' },
        shares: ruleVersionRow.allocation_shares.map((share) => ({
          key: share.key,
          recipientBehavior: share.recipient_behavior,
          label: share.label,
          weightBp: share.weight_bp as never,
          recipientOrgId: share.recipient_org_id,
        })),
      },
      base: exampleBase,
      basePolicyLabel: ruleVersionRow.base_policy.label,
      assignments: [],
      members: new Map(),
      organizations,
      unassignedLabel: copy.money.unassigned,
    });

    assignments = draft.suggested_assignments.map((suggestion) => {
      const share = ruleVersionRow.allocation_shares.find(
        (candidate) => candidate.key === suggestion.roleKey,
      );
      return {
        roleLabel: share?.label ?? suggestion.roleKey,
        shareOfBaseLabel: share === undefined ? '' : formatBasisPoints(share.weight_bp),
        rationale: suggestion.rationale,
        confidence: suggestion.confidence,
      };
    });
  }

  return {
    id: draft.id,
    origin: 'ai_extracted',
    sponsorName: draft.sponsor_name.value,
    programName: draft.program_name.value,
    sourceDocumentName: sourceDocument.filename,
    sourceDocumentKindLabel: SOURCE_DOCUMENT_KIND_LABELS[sourceDocument.kind],
    extractedAt: draft.extracted_at,
    matchedProjectName: matchedProject?.name ?? null,
    matchedProjectSlug: matchedProject?.slug ?? null,
    fields,
    services,
    milestones,
    assignments,
    projectedAllocation,
    projectedAllocationNote: draft.example_distributable_base_note,
    reviewIssues,
    confidenceOverall: overallConfidence([
      draft.sponsor_name.confidence,
      draft.program_name.confidence,
      draft.example_distributable_base.confidence,
      ...draft.suggested_assignments.map((s) => s.confidence),
    ]),
  };
}

export const supabaseIntakeRepository: IntakeRepository = {
  async runIntake(input: RunIntakeInput, viewer: ViewerContext): Promise<IntakeRunView> {
    assertFounder(viewer, 'runIntake');
    const client = await createSupabaseServerClient();
    if (client === null) {
      return {
        id: `unavailable-${input.idempotencyKey}`,
        status: 'error',
        sourceDocumentName: input.sourceDocumentFilename,
        draft: null,
        errorMessage: 'Supabase no está configurado en este entorno.',
        synthetic: true,
      };
    }

    const sourceDocumentId = await resolveSourceDocumentId(
      client,
      viewer.orgId,
      viewer.viewerId,
      input.sourceDocumentFilename,
    );

    const rpcResult = await client.rpc('run_intake', {
      p_org_id: viewer.orgId,
      p_source_document_id: sourceDocumentId,
      p_idempotency_key: input.idempotencyKey,
    });

    if (rpcResult.error !== null) {
      return {
        id: `error-${input.idempotencyKey}`,
        status: 'error',
        sourceDocumentName: input.sourceDocumentFilename,
        draft: null,
        errorMessage: rpcResult.error.message,
        synthetic: true,
      };
    }

    const row = (rpcResult.data as readonly { run_id: string; draft_id: string | null; status: string }[])[0];
    if (row === undefined) {
      return {
        id: `error-${input.idempotencyKey}`,
        status: 'error',
        sourceDocumentName: input.sourceDocumentFilename,
        draft: null,
        errorMessage: 'run_intake returned no row.',
        synthetic: true,
      };
    }

    if (row.status !== 'ready' || row.draft_id === null) {
      return {
        id: row.run_id,
        status: 'error',
        sourceDocumentName: input.sourceDocumentFilename,
        draft: null,
        errorMessage:
          'No hay un borrador disponible para este documento todavía. El adaptador local determinista no reconoce este archivo.',
        synthetic: true,
      };
    }

    const draft = await buildDraftView(client, row.draft_id);

    return {
      id: row.run_id,
      status: 'ready',
      sourceDocumentName: input.sourceDocumentFilename,
      draft,
      errorMessage: null,
      synthetic: true,
    };
  },

  async confirmContractDraft(
    input: ConfirmContractDraftInput,
    viewer: ViewerContext,
  ): Promise<ConfirmContractDraftResult> {
    assertFounder(viewer, 'confirmContractDraft');
    const client = await createSupabaseServerClient();
    if (client === null) {
      return { kind: 'unavailable', reason: copy.admin.intake.confirmBlockedReason };
    }

    const rpcResult = await client.rpc('confirm_contract_draft', {
      p_draft_id: input.draftId,
      p_org_id: viewer.orgId,
      p_sponsor_name: input.sponsorName,
      p_program_name: input.programName,
      p_currency: input.currency,
    });

    if (rpcResult.error !== null) {
      return { kind: 'error', message: rpcResult.error.message };
    }
    const row = (rpcResult.data as readonly { project_id: string; project_slug: string }[])[0];
    if (row === undefined) {
      return { kind: 'error', message: 'confirm_contract_draft returned no row.' };
    }
    return { kind: 'confirmed', projectId: row.project_id, projectSlug: row.project_slug };
  },

  async discardContractDraft(
    draftId: string,
    viewer: ViewerContext,
  ): Promise<DiscardContractDraftResult> {
    assertFounder(viewer, 'discardContractDraft');
    const client = await createSupabaseServerClient();
    if (client === null) {
      return { kind: 'unavailable', reason: copy.admin.intake.confirmBlockedReason };
    }

    const rpcResult = await client.rpc('discard_contract_draft', {
      p_draft_id: draftId,
      p_org_id: viewer.orgId,
    });

    if (rpcResult.error !== null) {
      return { kind: 'error', message: rpcResult.error.message };
    }
    return { kind: 'discarded' };
  },
};
