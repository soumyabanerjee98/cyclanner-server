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

export const distributeLoad = (totalLoad: number) => {
  return {
    easy: totalLoad * 0.8,
    hard: totalLoad * 0.2,
  };
};
