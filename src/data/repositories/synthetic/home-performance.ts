import { copy } from '@/copy/es-MX';
import type { SyntheticDataset } from '@/data/repositories/synthetic/dataset';
import { settlementLineBalances } from '@/data/repositories/synthetic/shared';
import { addMoney, subMoney, sumMoney, zeroMoney, type Money } from '@/lib/money';
import { deriveMemberStats } from '@/lib/stats';
import type { Settlement, SettlementLinePayout } from '@/types/domain';
import type {
  HomeCountPerformancePoint,
  HomeMoneyPerformancePoint,
  HomePerformanceHistory,
  MemberMoney,
} from '@/types/views';

interface PayoutEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly opportunityId: string;
  readonly payouts: readonly SettlementLinePayout[];
  readonly delta: Money;
  readonly correction: boolean;
}

interface PayableReplayEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly sourceLabel: string;
  readonly state: HomeMoneyPerformancePoint['state'];
  readonly settlement?: Settlement;
  readonly payouts?: readonly SettlementLinePayout[];
}

function timestamp(value: string): number {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value).getTime();
}

function opportunityCode(dataset: SyntheticDataset, opportunityId: string): string {
  return dataset.opportunities.find((entry) => entry.id === opportunityId)?.code ?? opportunityId;
}

function sourceLabel(prefix: string, dataset: SyntheticDataset, opportunityId: string): string {
  return `${prefix} · ${opportunityCode(dataset, opportunityId)}`;
}

function compareDated(
  left: { readonly occurredAt: string; readonly id: string },
  right: { readonly occurredAt: string; readonly id: string },
): number {
  return timestamp(left.occurredAt) - timestamp(right.occurredAt) || left.id.localeCompare(right.id);
}

function approvedHistory(
  dataset: SyntheticDataset,
  memberId: string,
): HomeMoneyPerformancePoint[] {
  let current = zeroMoney();
  const points: HomeMoneyPerformancePoint[] = [];

  const events = dataset.settlements
    .filter((settlement) => settlement.status === 'approved' && settlement.approvedAt !== null)
    .map((settlement) => ({
      settlement,
      id: settlement.id,
      occurredAt: settlement.approvedAt as string,
      delta: sumMoney(
        dataset.settlementLines
          .filter(
            (line) => line.settlementId === settlement.id && line.memberId === memberId,
          )
          .map((line) => line.amount),
      ),
    }))
    .filter((event) => event.delta.amount !== 0)
    .sort(compareDated);

  for (const event of events) {
    current = addMoney(current, event.delta);
    const correction = event.settlement.kind !== 'original' || event.delta.amount < 0;
    points.push({
      id: `approved:${event.id}`,
      occurredAt: event.occurredAt,
      value: current,
      delta: event.delta,
      sourceLabel: sourceLabel(
        correction
          ? copy.home.commandStrip.sources.settlementCorrected
          : copy.home.commandStrip.sources.settlementApproved,
        dataset,
        event.settlement.opportunityId,
      ),
      state: correction ? 'correction' : 'verified',
    });
  }

  return points;
}

function memberPayoutEvents(dataset: SyntheticDataset, memberId: string): PayoutEvent[] {
  const lineById = new Map(dataset.settlementLines.map((line) => [line.id, line]));
  const settlementById = new Map(dataset.settlements.map((settlement) => [settlement.id, settlement]));
  const grouped = new Map<
    string,
    { occurredAt: string; opportunityId: string; payouts: SettlementLinePayout[] }
  >();

  for (const payout of dataset.settlementLinePayouts) {
    const line = lineById.get(payout.settlementLineId);
    if (line?.memberId !== memberId) continue;
    const settlement = settlementById.get(line.settlementId);
    if (settlement === undefined) continue;

    const existing = grouped.get(payout.payoutCashEventId);
    if (existing === undefined) {
      grouped.set(payout.payoutCashEventId, {
        occurredAt: payout.createdAt,
        opportunityId: settlement.opportunityId,
        payouts: [payout],
      });
    } else {
      existing.payouts.push(payout);
    }
  }

  return [...grouped.entries()]
    .map(([id, event]) => {
      const delta = sumMoney(event.payouts.map((payout) => payout.amount));
      return {
        id,
        occurredAt: event.occurredAt,
        opportunityId: event.opportunityId,
        payouts: event.payouts,
        delta,
        correction: event.payouts.some((payout) => payout.amount.amount < 0),
      };
    })
    .sort(compareDated);
}

function paidHistory(dataset: SyntheticDataset, memberId: string): HomeMoneyPerformancePoint[] {
  let current = zeroMoney();
  return memberPayoutEvents(dataset, memberId).map((event) => {
    current = addMoney(current, event.delta);
    return {
      id: `paid:${event.id}`,
      occurredAt: event.occurredAt,
      value: current,
      delta: event.delta,
      sourceLabel: sourceLabel(
        event.correction
          ? copy.home.commandStrip.sources.payoutCorrected
          : copy.home.commandStrip.sources.payoutRecorded,
        dataset,
        event.opportunityId,
      ),
      state: event.correction ? 'correction' : 'verified',
    };
  });
}

function approvedSettlementsForMember(
  dataset: SyntheticDataset,
  memberId: string,
): Settlement[] {
  const settlementIds = new Set(
    dataset.settlementLines
      .filter((line) => line.memberId === memberId)
      .map((line) => line.settlementId),
  );
  return dataset.settlements.filter(
    (settlement) =>
      settlement.status === 'approved' &&
      settlement.approvedAt !== null &&
      settlementIds.has(settlement.id),
  );
}

function payableHistory(
  dataset: SyntheticDataset,
  memberId: string,
): HomeMoneyPerformancePoint[] {
  const events: PayableReplayEvent[] = [
    ...approvedSettlementsForMember(dataset, memberId).map((settlement) => {
      const correction = settlement.kind !== 'original';
      return {
        id: `settlement:${settlement.id}`,
        occurredAt: settlement.approvedAt as string,
        sourceLabel: sourceLabel(
          correction
            ? copy.home.commandStrip.sources.settlementCorrected
            : copy.home.commandStrip.sources.settlementApproved,
          dataset,
          settlement.opportunityId,
        ),
        state: correction ? ('correction' as const) : ('verified' as const),
        settlement,
      };
    }),
    ...memberPayoutEvents(dataset, memberId).map((event) => ({
      id: `payout:${event.id}`,
      occurredAt: event.occurredAt,
      sourceLabel: sourceLabel(
        event.correction
          ? copy.home.commandStrip.sources.payoutCorrected
          : copy.home.commandStrip.sources.payoutRecorded,
        dataset,
        event.opportunityId,
      ),
      state: event.correction ? ('correction' as const) : ('verified' as const),
      payouts: event.payouts,
    })),
  ];
  events.sort((left, right) => {
    const dateOrder = compareDated(left, right);
    if (dateOrder !== 0) return dateOrder;
    if (left.settlement?.kind === 'reversal') return -1;
    if (right.settlement?.kind === 'reversal') return 1;
    if (left.settlement !== undefined && right.payouts !== undefined) return -1;
    if (left.payouts !== undefined && right.settlement !== undefined) return 1;
    return left.id.localeCompare(right.id);
  });

  const includedSettlements: Settlement[] = [];
  const includedPayouts: SettlementLinePayout[] = [];
  let previousOwed = zeroMoney();
  let previousRecovery = zeroMoney();
  const points: HomeMoneyPerformancePoint[] = [];

  for (const event of events) {
    if (event.settlement !== undefined) includedSettlements.push(event.settlement);
    if (event.payouts !== undefined) includedPayouts.push(...event.payouts);

    const snapshot = {
      ...dataset,
      settlements: includedSettlements,
      settlementLinePayouts: includedPayouts,
    } satisfies SyntheticDataset;
    const balances = settlementLineBalances(snapshot).filter(
      (balance) => balance.line.memberId === memberId,
    );
    const owed = sumMoney(balances.map((balance) => balance.owed));
    const recovery = sumMoney(balances.map((balance) => balance.recovery));
    const delta = subMoney(owed, previousOwed);
    const recoveryIncreased = recovery.amount > previousRecovery.amount;

    if (delta.amount !== 0 || event.state === 'correction' || recoveryIncreased) {
      points.push({
        id: `payable:${event.id}`,
        occurredAt: event.occurredAt,
        value: owed,
        delta,
        sourceLabel: event.sourceLabel,
        state: recoveryIncreased ? 'recovery' : event.state,
      });
    }

    previousOwed = owed;
    previousRecovery = recovery;
  }

  return points;
}

function closedHistory(
  dataset: SyntheticDataset,
  memberId: string,
): HomeCountPerformancePoint[] {
  let current = 0;
  return dataset.statEvents
    .filter((event) => event.memberId === memberId && event.metricKey === 'opportunity_closed')
    .map((event) => ({ ...event, id: `closed:${event.id}` }))
    .sort(compareDated)
    .map((event) => {
      current += event.quantity;
      const correction = event.reversesStatEventId !== null || event.quantity < 0;
      return {
        id: event.id,
        occurredAt: event.occurredAt,
        value: current,
        delta: event.quantity,
        sourceLabel: sourceLabel(
          correction
            ? copy.home.commandStrip.sources.closeCorrected
            : copy.home.commandStrip.sources.closeVerified,
          dataset,
          event.opportunityId,
        ),
        state: correction ? 'correction' : 'verified',
      };
    });
}

function snapshotAsOf(dataset: SyntheticDataset): string {
  const dates = [
    ...dataset.settlements.flatMap((settlement) =>
      settlement.approvedAt === null ? [] : [settlement.approvedAt],
    ),
    ...dataset.settlementLinePayouts.map((payout) => payout.createdAt),
    ...dataset.statEvents.map((event) => event.occurredAt),
  ];
  const latest = dates.reduce((maximum, value) => Math.max(maximum, timestamp(value)), 0);
  return new Date(latest).toISOString();
}

export function buildHomePerformanceHistory(
  dataset: SyntheticDataset,
  memberId: string,
  memberMoney: MemberMoney,
): HomePerformanceHistory {
  const approved = approvedHistory(dataset, memberId);
  const paid = paidHistory(dataset, memberId);
  const approvedUnpaid = payableHistory(dataset, memberId);
  const closed = closedHistory(dataset, memberId);
  const stats = deriveMemberStats(dataset.statEvents.filter((event) => event.memberId === memberId));

  return {
    asOf: snapshotAsOf(dataset),
    series: [
      {
        kind: 'money',
        key: 'approved',
        current: memberMoney.approved,
        historyAvailability: 'available',
        points: approved,
      },
      {
        kind: 'money',
        key: 'paid',
        current: memberMoney.paid,
        historyAvailability: 'available',
        points: paid,
      },
      {
        kind: 'money',
        key: 'approved_unpaid',
        current: memberMoney.approvedUnpaid,
        historyAvailability: 'available',
        points: approvedUnpaid,
      },
      {
        kind: 'money',
        key: 'projected',
        current: memberMoney.projected,
        historyAvailability: 'unavailable',
        points: [],
      },
      {
        kind: 'count',
        key: 'closed',
        current: stats.closed,
        historyAvailability: 'available',
        points: closed,
      },
    ],
  };
}
