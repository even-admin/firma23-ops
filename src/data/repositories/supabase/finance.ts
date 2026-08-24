/**
 * Supabase-backed finance write adapter.
 *
 * Exposes only the two P3 canonical write doors this repository owns —
 * record_cash_event and record_payout — as plain functions rather than a
 * full FinanceRepository object literal. No Supabase read implementation
 * for getOverview/getSettlementPreview exists yet; every route still reads
 * through the synthetic adapter directly, and building a parallel read path
 * here was out of scope for "the audited canonical finance write boundary."
 * Building one is real M2 work, just not this one.
 *
 * This file has never run against a live project: no Supabase project is
 * reachable from this environment. It compiles and type-checks against the
 * frozen FinanceRepository input/result types, and every RPC it calls was
 * verified against a local, throwaway Postgres instance instead (see
 * scripts/db-verify.sh).
 */

import { copy } from '@/copy/es-MX';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertFounder, type ViewerContext } from '@/lib/viewer';
import type {
  RecordCashEventInput,
  RecordCashEventResult,
  RecordPayoutInput,
  RecordPayoutResult,
} from '@/types/views';

export async function recordCashEvent(
  input: RecordCashEventInput,
  viewer: ViewerContext,
): Promise<RecordCashEventResult> {
  assertFounder(viewer, 'recordCashEvent');
  const client = await createSupabaseServerClient();
  if (client === null) {
    return { kind: 'unavailable', reason: copy.finance.writeBlockedReason };
  }

  const rpcResult = await client.rpc('record_cash_event', {
    p_org_id: viewer.orgId,
    p_opportunity_id: input.opportunityId,
    p_type: input.type,
    p_label: input.label,
    p_amount_centavos: input.amount.amount,
    p_currency: input.amount.currency,
    p_occurred_at: input.occurredAt,
    p_idempotency_key: input.idempotencyKey,
  });

  if (rpcResult.error !== null) {
    return { kind: 'error', message: rpcResult.error.message };
  }

  const row = (rpcResult.data as readonly { cash_event_id: string; replayed: boolean }[])[0];
  if (row === undefined) {
    return { kind: 'error', message: 'record_cash_event returned no row.' };
  }

  return { kind: 'recorded', cashEventId: row.cash_event_id, replayed: row.replayed };
}

export async function recordPayout(
  input: RecordPayoutInput,
  viewer: ViewerContext,
): Promise<RecordPayoutResult> {
  assertFounder(viewer, 'recordPayout');
  const client = await createSupabaseServerClient();
  if (client === null) {
    return { kind: 'unavailable', reason: copy.finance.writeBlockedReason };
  }

  const rpcResult = await client.rpc('record_payout', {
    p_org_id: viewer.orgId,
    p_opportunity_id: input.opportunityId,
    p_label: input.label,
    p_occurred_at: input.occurredAt,
    p_allocations: input.allocations.map((allocation) => ({
      settlementLineId: allocation.settlementLineId,
      amountCentavos: allocation.amount.amount,
    })),
    p_idempotency_key: input.idempotencyKey,
    p_existing_cash_event_id: input.existingCashEventId ?? null,
  });

  if (rpcResult.error !== null) {
    return { kind: 'error', message: rpcResult.error.message };
  }

  const row = (rpcResult.data as readonly { cash_event_id: string; replayed: boolean }[])[0];
  if (row === undefined) {
    return { kind: 'error', message: 'record_payout returned no row.' };
  }

  return { kind: 'recorded', cashEventId: row.cash_event_id, replayed: row.replayed };
}
