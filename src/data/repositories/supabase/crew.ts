/**
 * Supabase-backed crew repository.
 *
 * The only write path is the SECURITY DEFINER RPC replace_opportunity_crew
 * (see supabase/migrations/20260827090000_opportunity_crew_management.sql),
 * which locks the target opportunity, validates the full replacement
 * payload, refuses the command outright once any settlement authority
 * exists, and writes exactly one audit event on a genuine change.
 */

import { copy } from '@/copy/es-MX';
import type { CrewRepository } from '@/data/repositories/crew';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type {
  CrewChangeAssignmentView,
  CrewChangeReceiptView,
  ReplaceOpportunityCrewInput,
  ReplaceOpportunityCrewResult,
} from '@/types/views';

interface CrewReceiptRow {
  readonly id: string;
  readonly role_key: string;
  readonly before_assignments: unknown;
  readonly after_assignments: unknown;
  readonly created_at: string;
}

function parseAssignments(value: unknown, receiptId: string): readonly CrewChangeAssignmentView[] {
  if (!Array.isArray(value)) {
    throw new Error(`Crew receipt ${receiptId} has an invalid assignment snapshot.`);
  }

  return value.map((entry) => {
    const record = entry as Record<string, unknown>;
    if (
      typeof entry !== 'object' ||
      entry === null ||
      Array.isArray(entry) ||
      typeof record.memberId !== 'string' ||
      typeof record.roleLabel !== 'string' ||
      typeof record.weightBp !== 'number' ||
      !Number.isInteger(record.weightBp) ||
      record.weightBp <= 0 ||
      record.weightBp > 10_000
    ) {
      throw new Error(`Crew receipt ${receiptId} has an invalid assignment snapshot.`);
    }

    return {
      memberId: record.memberId,
      roleLabel: record.roleLabel,
      weightBp: record.weightBp as CrewChangeAssignmentView['weightBp'],
    };
  });
}

export const supabaseCrewRepository: CrewRepository = {
  async listOpportunityCrewReceipts(
    opportunityId: string,
    viewer: ViewerContext,
  ): Promise<readonly CrewChangeReceiptView[]> {
    assertFounder(viewer, 'listOpportunityCrewReceipts');
    const client = await createSupabaseServerClient();
    if (client === null) return [];

    const { data, error } = await client
      .from('opportunity_crew_receipts')
      .select('id, role_key, before_assignments, after_assignments, created_at')
      .eq('org_id', viewer.orgId)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });
    if (error !== null) throw new Error(error.message);

    return ((data ?? []) as readonly CrewReceiptRow[]).map((row) => ({
      id: row.id,
      roleKey: row.role_key,
      beforeAssignments: parseAssignments(row.before_assignments, row.id),
      afterAssignments: parseAssignments(row.after_assignments, row.id),
      createdAt: row.created_at,
    }));
  },

  async replaceOpportunityCrew(
    input: ReplaceOpportunityCrewInput,
    viewer: ViewerContext,
  ): Promise<ReplaceOpportunityCrewResult> {
    assertFounder(viewer, 'replaceOpportunityCrew');
    const client = await createSupabaseServerClient();
    if (client === null) {
      return { kind: 'unavailable', reason: copy.detail.crew.unavailable };
    }

    const rpcResult = await client.rpc('replace_opportunity_crew', {
      p_org_id: viewer.orgId,
      p_opportunity_id: input.opportunityId,
      p_role_key: input.roleKey,
      p_assignments: input.assignments.map((assignment) => ({
        memberId: assignment.memberId,
        roleLabel: assignment.roleLabel,
        weightBp: assignment.weightBp,
      })),
      p_idempotency_key: input.idempotencyKey,
    });

    if (rpcResult.error !== null) {
      return { kind: 'error', message: rpcResult.error.message };
    }
    const row = (
      rpcResult.data as readonly { opportunity_id: string; replayed: boolean }[]
    )[0];
    if (row === undefined) {
      return { kind: 'error', message: 'replace_opportunity_crew returned no row.' };
    }
    return { kind: 'replaced', opportunityId: row.opportunity_id, replayed: row.replayed };
  },
};
