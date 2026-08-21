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
  const count = (type: StatEvent['type']): number =>
    events.filter((event) => event.type === type).length;

  const onTime = count('delivered_on_time');
  const late = count('delivered_late');
  const acceptedFirstPass = count('accepted_first_pass');
  const revisionsRequested = count('revision_requested');

  return {
    closed: count('opportunity_closed'),
    delivered: count('delivery_completed'),
    onTime,
    late,
    revisionsRequested,
    acceptedFirstPass,
    onTimeRateBp: rate(onTime, onTime + late),
    acceptanceRateBp: rate(acceptedFirstPass, acceptedFirstPass + revisionsRequested),
  };
}
