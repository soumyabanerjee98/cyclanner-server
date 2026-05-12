import {
  getHRZones,
  intensityFactor,
  progressionRate,
} from '@/config/strava.config.js';

export const classifyIntensity = (avgHR: number, maxHR: number) => {
  const zones = getHRZones(maxHR);

  for (const [zone, [min, max]] of Object.entries(zones)) {
    if (avgHR >= min! && avgHR <= max!) return zone;
  }

  return 'unknown';
};

export const calculateTrainingLoad = (
  duration: number, // seconds
  zone: string,
) => {
  const factor: number =
    intensityFactor[zone as keyof typeof intensityFactor] || 1;
  return (duration / 60) * factor; // minutes * factor
};

export const getTargetWeeklyLoad = (currentLoad: number, level: string) => {
  return (
    currentLoad * (1 + progressionRate[level as keyof typeof progressionRate])
  );
};

export const adjustForFatigue = (targetLoad: number, fatigue: number) => {
  if (fatigue > targetLoad * 1.5) {
    return targetLoad * 0.7; // recovery week
  }

  return targetLoad;
};

export const distributeLoad = (totalLoad: number) => {
  return {
    easy: totalLoad * 0.8,
    hard: totalLoad * 0.2,
  };
};

export const generateWeeklyPlan = (totalLoad: number) => {
  const { easy, hard } = distributeLoad(totalLoad);

  return [
    { day: 'Mon', type: 'rest', load: 0 },

    { day: 'Tue', type: 'hard', load: hard * 0.4 },
    { day: 'Wed', type: 'easy', load: easy * 0.2 },

    { day: 'Thu', type: 'hard', load: hard * 0.4 },
    { day: 'Fri', type: 'easy', load: easy * 0.2 },

    { day: 'Sat', type: 'long', load: easy * 0.4 },
    { day: 'Sun', type: 'recovery', load: easy * 0.2 },
  ];
};
