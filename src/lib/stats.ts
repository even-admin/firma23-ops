/**
 * Derived member statistics.
 *
 * Stats are computed from append-only stat events on every read. Nothing is
 * stored, so there is no field for a member to edit and no drift between the
 * events and the number shown.
 */

import { basisPoints, BASIS_POINTS_TOTAL, type BasisPoints } from '@/lib/money';
import type { StatEvent } from '@/types/domain';
import type { MemberStats } from '@/types/views';

function rate(numerator: number, denominator: number): BasisPoints | null {
  if (denominator === 0) return null;
  return basisPoints(Math.round((numerator / denominator) * BASIS_POINTS_TOTAL));
}

export function deriveMemberStats(events: readonly StatEvent[]): MemberStats {
  // Sum signed quantity, not row count: a reversal is a second row carrying
  // the exact negative quantity of the fact it corrects, so summing is what
  // keeps history append-only while still reflecting the correction.
  const total = (metricKey: StatEvent['metricKey']): number =>
    events
      .filter((event) => event.metricKey === metricKey)
      .reduce((sum, event) => sum + event.quantity, 0);

  const onTime = total('delivered_on_time');
  const late = total('delivered_late');
  const acceptedFirstPass = total('accepted_first_pass');
  const revisionsRequested = total('revision_requested');

  return {
    closed: total('opportunity_closed'),
    delivered: total('delivery_completed'),
    onTime,
    late,
    revisionsRequested,
    acceptedFirstPass,
    onTimeRateBp: rate(onTime, onTime + late),
    acceptanceRateBp: rate(acceptedFirstPass, acceptedFirstPass + revisionsRequested),
  };
}
