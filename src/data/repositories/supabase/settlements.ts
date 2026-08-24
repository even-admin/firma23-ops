/**
 * Supabase-backed settlement write adapter.
 *
 * Exposes only the two P3 canonical write doors this repository owns —
 * approve_settlement and reverse_settlement — as plain functions rather
 * than a full SettlementRepository object literal. No Supabase read
 * implementation for listOpportunityRails/getOpportunityRail exists yet;
 * every route still reads through the synthetic adapter directly, and
 * building a parallel read path here was out of scope for "the audited
 * canonical finance write boundary." Building one is real M2 work, just
 * not this one.
 *
 * This file has never run against a live project: no Supabase project is
 * reachable from this environment. It compiles and type-checks against the
 * frozen SettlementRepository input/result types, and every RPC it calls
 * was verified against a local, throwaway Postgres instance instead (see
 * scripts/db-verify.sh).
 */

import { copy } from '@/copy/es-MX';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type {
  ApproveSettlementInput,
  ApproveSettlementResult,
  ReverseSettlementInput,
  ReverseSettlementResult,
} from '@/types/views';

export async function approveSettlement(
  input: ApproveSettlementInput,
  viewer: ViewerContext,
): Promise<ApproveSettlementResult> {
  assertFounder(viewer, 'approveSettlement');
  const client = await createSupabaseServerClient();
  if (client === null) {
    return { kind: 'unavailable', reason: copy.finance.writeBlockedReason };
  }

  const rpcResult = await client.rpc('approve_settlement', {
    p_org_id: viewer.orgId,
    p_opportunity_id: input.opportunityId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (rpcResult.error !== null) {
    return { kind: 'error', message: rpcResult.error.message };
  }

  const row = (rpcResult.data as readonly { settlement_id: string; replayed: boolean }[])[0];
  if (row === undefined) {
    return { kind: 'error', message: 'approve_settlement returned no row.' };
  }

  return { kind: 'approved', settlementId: row.settlement_id, replayed: row.replayed };
}

export async function reverseSettlement(
  input: ReverseSettlementInput,
  viewer: ViewerContext,
): Promise<ReverseSettlementResult> {
  assertFounder(viewer, 'reverseSettlement');
  const client = await createSupabaseServerClient();
  if (client === null) {
    return { kind: 'unavailable', reason: copy.finance.writeBlockedReason };
  }

  const rpcResult = await client.rpc('reverse_settlement', {
    p_org_id: viewer.orgId,
    p_settlement_id: input.settlementId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (rpcResult.error !== null) {
    return { kind: 'error', message: rpcResult.error.message };
  }

  const row = (rpcResult.data as readonly { settlement_id: string; replayed: boolean }[])[0];
  if (row === undefined) {
    return { kind: 'error', message: 'reverse_settlement returned no row.' };
  }

  return { kind: 'reversed', settlementId: row.settlement_id, replayed: row.replayed };
}
