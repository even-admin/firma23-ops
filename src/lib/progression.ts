import { basisPoints, BASIS_POINTS_TOTAL } from '@/lib/money';
import type { MemberStats, ProgressionView } from '@/types/views';

/**
 * V1 progression is a read projection over verified, signed stat events.
 * Changing these weights requires a new version; financial and ranking
 * semantics never depend on this score.
 */
export const PROGRESSION_RULESET_V1 = {
  version: 1,
  weights: {
    closed: 120,
    delivered: 100,
    onTime: 30,
    acceptedFirstPass: 40,
    late: -20,
    revisionsRequested: -10,
  },
  levelThresholds: [0, 180, 480, 900, 1_440, 2_100] as const,
} as const;

export function deriveProgression(stats: MemberStats): ProgressionView {
  const weights = PROGRESSION_RULESET_V1.weights;
  const xp = Math.max(
    0,
    stats.closed * weights.closed +
      stats.delivered * weights.delivered +
      stats.onTime * weights.onTime +
      stats.acceptedFirstPass * weights.acceptedFirstPass +
      stats.late * weights.late +
      stats.revisionsRequested * weights.revisionsRequested,
  );

  const thresholds = PROGRESSION_RULESET_V1.levelThresholds;
  let levelIndex = thresholds.findLastIndex((threshold) => xp >= threshold);
  if (levelIndex < 0) levelIndex = 0;
  const currentThreshold = thresholds[levelIndex] ?? 0;
  const nextThreshold = thresholds[levelIndex + 1] ?? null;
  const progressBp =
    nextThreshold === null
      ? basisPoints(BASIS_POINTS_TOTAL)
      : basisPoints(
          Math.min(
            BASIS_POINTS_TOTAL,
            Math.round(
              ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * BASIS_POINTS_TOTAL,
            ),
          ),
        );

  return {
    rulesetVersion: PROGRESSION_RULESET_V1.version,
    level: levelIndex + 1,
    xp,
    currentLevelXp: currentThreshold,
    nextLevelXp: nextThreshold,
    progressBp,
  };
}
