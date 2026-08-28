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
import type { ReplaceOpportunityCrewInput, ReplaceOpportunityCrewResult } from '@/types/views';

export const supabaseCrewRepository: CrewRepository = {
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
