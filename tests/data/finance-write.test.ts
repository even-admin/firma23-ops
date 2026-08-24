/**
 * Repository-level tests for the P3 canonical finance write boundary.
 *
 * The synthetic/local adapter must never pretend a write succeeded — every
 * method here must answer `unavailable`, exactly like the existing
 * confirmContractDraft/discardContractDraft methods on the intake
 * repository. The Supabase adapter has no live project reachable from this
 * environment (see scripts/db-verify.sh for the RPCs' own correctness
 * evidence against a disposable Postgres instance instead), so what is
 * testable here without a real request context is: the founder-only guard
 * fires before any network attempt, and the adapter reports `unavailable`
 * cleanly instead of throwing when Supabase is not configured — the only
 * two things a route can actually observe in this environment.
 */

import { describe, expect, it } from 'vitest';

import { PROTOTYPE_FOUNDER, PROTOTYPE_MEMBER } from '@/data/prototype-viewers';
import { syntheticFinanceRepository } from '@/data/repositories/synthetic/finance';
import { syntheticSettlementRepository } from '@/data/repositories/synthetic/settlements';
import * as supabaseFinance from '@/data/repositories/supabase/finance';
import * as supabaseSettlements from '@/data/repositories/supabase/settlements';
import { money } from '@/lib/money';
import { PermissionError } from '@/lib/viewer';

const OPPORTUNITY_ID = 'f0000000-0000-4000-8000-000000000001';
const SETTLEMENT_ID = '20000000-0000-4000-8000-000000000002';
const SETTLEMENT_LINE_ID = '40000000-0000-4000-8000-000000000001';

const RECORD_CASH_EVENT_INPUT = {
  opportunityId: OPPORTUNITY_ID,
  type: 'deposit' as const,
  label: 'Test deposit',
  amount: money(100_000),
  occurredAt: '2026-08-23',
  idempotencyKey: 'test-key-1',
};

const RECORD_PAYOUT_INPUT = {
  opportunityId: OPPORTUNITY_ID,
  label: 'Test payout',
  occurredAt: '2026-08-23',
  allocations: [{ settlementLineId: SETTLEMENT_LINE_ID, amount: money(1_000) }],
  idempotencyKey: 'test-key-2',
};

const APPROVE_SETTLEMENT_INPUT = { opportunityId: OPPORTUNITY_ID, idempotencyKey: 'test-key-3' };
const REVERSE_SETTLEMENT_INPUT = { settlementId: SETTLEMENT_ID, idempotencyKey: 'test-key-4' };

describe('synthetic finance write methods stay honest', () => {
  it('recordCashEvent never pretends to persist', async () => {
    const result = await syntheticFinanceRepository.recordCashEvent(
      RECORD_CASH_EVENT_INPUT,
      PROTOTYPE_FOUNDER,
    );
    expect(result.kind).toBe('unavailable');
  });

  it('recordPayout never pretends to persist', async () => {
    const result = await syntheticFinanceRepository.recordPayout(
      RECORD_PAYOUT_INPUT,
      PROTOTYPE_FOUNDER,
    );
    expect(result.kind).toBe('unavailable');
  });

  it('recordCashEvent still refuses a non-founder viewer', async () => {
    await expect(
      syntheticFinanceRepository.recordCashEvent(RECORD_CASH_EVENT_INPUT, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });

  it('recordPayout still refuses a non-founder viewer', async () => {
    await expect(
      syntheticFinanceRepository.recordPayout(RECORD_PAYOUT_INPUT, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });
});

describe('synthetic settlement write methods stay honest', () => {
  it('approveSettlement never pretends to persist', async () => {
    const result = await syntheticSettlementRepository.approveSettlement(
      APPROVE_SETTLEMENT_INPUT,
      PROTOTYPE_FOUNDER,
    );
    expect(result.kind).toBe('unavailable');
  });

  it('reverseSettlement never pretends to persist', async () => {
    const result = await syntheticSettlementRepository.reverseSettlement(
      REVERSE_SETTLEMENT_INPUT,
      PROTOTYPE_FOUNDER,
    );
    expect(result.kind).toBe('unavailable');
  });

  it('approveSettlement still refuses a non-founder viewer', async () => {
    await expect(
      syntheticSettlementRepository.approveSettlement(APPROVE_SETTLEMENT_INPUT, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });

  it('reverseSettlement still refuses a non-founder viewer', async () => {
    await expect(
      syntheticSettlementRepository.reverseSettlement(REVERSE_SETTLEMENT_INPUT, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });
});

describe('supabase finance/settlement write adapters', () => {
  it('recordCashEvent refuses a non-founder viewer before any network attempt', async () => {
    await expect(
      supabaseFinance.recordCashEvent(RECORD_CASH_EVENT_INPUT, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });

  it('recordPayout refuses a non-founder viewer before any network attempt', async () => {
    await expect(
      supabaseFinance.recordPayout(RECORD_PAYOUT_INPUT, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });

  it('approveSettlement refuses a non-founder viewer before any network attempt', async () => {
    await expect(
      supabaseSettlements.approveSettlement(APPROVE_SETTLEMENT_INPUT, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });

  it('reverseSettlement refuses a non-founder viewer before any network attempt', async () => {
    await expect(
      supabaseSettlements.reverseSettlement(REVERSE_SETTLEMENT_INPUT, PROTOTYPE_MEMBER),
    ).rejects.toThrow(PermissionError);
  });

  it('recordCashEvent reports unavailable, not a crash, when Supabase is unconfigured', async () => {
    const result = await supabaseFinance.recordCashEvent(RECORD_CASH_EVENT_INPUT, PROTOTYPE_FOUNDER);
    expect(result.kind).toBe('unavailable');
  });

  it('recordPayout reports unavailable, not a crash, when Supabase is unconfigured', async () => {
    const result = await supabaseFinance.recordPayout(RECORD_PAYOUT_INPUT, PROTOTYPE_FOUNDER);
    expect(result.kind).toBe('unavailable');
  });

  it('approveSettlement reports unavailable, not a crash, when Supabase is unconfigured', async () => {
    const result = await supabaseSettlements.approveSettlement(
      APPROVE_SETTLEMENT_INPUT,
      PROTOTYPE_FOUNDER,
    );
    expect(result.kind).toBe('unavailable');
  });

  it('reverseSettlement reports unavailable, not a crash, when Supabase is unconfigured', async () => {
    const result = await supabaseSettlements.reverseSettlement(
      REVERSE_SETTLEMENT_INPUT,
      PROTOTYPE_FOUNDER,
    );
    expect(result.kind).toBe('unavailable');
  });
});
