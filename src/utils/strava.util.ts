import { getHRZones, progressionRate } from '@/config/strava.config.js';

export const classifyIntensity = (
  avgHR: number,
  maxHR: number,
): 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'unknown' => {
  const zones = getHRZones(maxHR);

  for (const [zone, [min, max]] of Object.entries(zones)) {
    if (avgHR >= min! && avgHR < max!) {
      return zone as 'z1' | 'z2' | 'z3' | 'z4' | 'z5';
    }
  }

  return 'unknown';
};

export const calculateHrTrainingLoad = ({
  avgHR,
  maxHR,
  durationSeconds,
}: {
  avgHR: number;
  maxHR: number;
  durationSeconds: number;
}) => {
  const durationMinutes = durationSeconds / 60;

  /**
   * HR intensity ratio
   */

  const hrRatio = avgHR / maxHR;

  /**
   * Simplified TRIMP
   *
   * Typical cycling ranges:
   *
   * Recovery:
   * 15-35
   *
   * Endurance:
   * 40-70
   *
   * Hard:
   * 70-120
   *
   * Race:
   * 120+
   */

  const load = durationMinutes * hrRatio * 1.5;

  return Math.round(Math.max(5, Math.min(load, 250)));
};

export const distributeLoad = (totalLoad: number) => {
  return {
    easy: totalLoad * 0.8,
    hard: totalLoad * 0.2,
  };
};

export const calculateTargetLoad = (
  currentLoad: number,
  level: ExperienceLevel,
) => {
  const progression = progressionRate[level] || 0.06;

  return Number((currentLoad * (1 + progression)).toFixed(2));
};

export const calculateAdjustedLoad = (targetLoad: number, tsb: number) => {
  let factor = 1;

  /*
    TSB Interpretation

    > 10      = very fresh
    0 to 10   = ready
    -10 to 0  = manageable fatigue
    -20 to -10 = high fatigue
    < -20     = excessive fatigue
  */

  if (tsb < -20) {
    factor = 0.75;
  } else if (tsb < -10) {
    factor = 0.85;
  } else if (tsb < 0) {
    factor = 0.95;
  } else if (tsb > 10) {
    factor = 1.03;
  }

  return Number((targetLoad * factor).toFixed(2));
};

export const deriveTrainingState = ({
  currentLoad,

  atl,

  ctl,

  tsb,

  experienceLevel,
}: {
  currentLoad: number;

  atl: number;

  ctl: number;

  tsb?: number;

  experienceLevel: ExperienceLevel;
}): TrainingState => {
  // fallback derivation
  const readiness = tsb ?? Number((ctl - atl).toFixed(2));

  const targetLoad = calculateTargetLoad(currentLoad, experienceLevel);

  const adjustedLoad = calculateAdjustedLoad(targetLoad, readiness);

  return {
    currentLoad: Number(currentLoad.toFixed(2)),

    targetLoad,

    adjustedLoad,

    fatigue: Number(atl.toFixed(2)),

    fitness: Number(ctl.toFixed(2)),

    readiness: Number(readiness.toFixed(2)),
  };
};
