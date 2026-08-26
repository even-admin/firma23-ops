import { describe, expect, it } from 'vitest';

import { deriveProgression, PROGRESSION_RULESET_V1 } from '@/lib/progression';
import type { MemberStats } from '@/types/views';

const EMPTY: MemberStats = {
  closed: 0,
  delivered: 0,
  onTime: 0,
  late: 0,
  revisionsRequested: 0,
  acceptedFirstPass: 0,
  onTimeRateBp: null,
  acceptanceRateBp: null,
};

describe('verified outcome progression', () => {
  it('starts at level one and never creates negative XP', () => {
    expect(deriveProgression(EMPTY)).toMatchObject({ level: 1, xp: 0, rulesetVersion: 1 });
    expect(
      deriveProgression({ ...EMPTY, late: 3, revisionsRequested: 4 }),
    ).toMatchObject({ level: 1, xp: 0 });
  });

  it('uses only the frozen V1 outcome weights', () => {
    const progression = deriveProgression({
      ...EMPTY,
      closed: 1,
      delivered: 2,
      onTime: 2,
      acceptedFirstPass: 1,
    });
    expect(progression.xp).toBe(
      PROGRESSION_RULESET_V1.weights.closed +
        PROGRESSION_RULESET_V1.weights.delivered * 2 +
        PROGRESSION_RULESET_V1.weights.onTime * 2 +
        PROGRESSION_RULESET_V1.weights.acceptedFirstPass,
    );
    expect(progression.level).toBe(2);
  });

  it('keeps corrections reversible because signed stats feed the projection', () => {
    const before = deriveProgression({ ...EMPTY, delivered: 2, onTime: 2 });
    const afterCorrection = deriveProgression({ ...EMPTY, delivered: 1, onTime: 1 });
    expect(afterCorrection.xp).toBeLessThan(before.xp);
  });
});
