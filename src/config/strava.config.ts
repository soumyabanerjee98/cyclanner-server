export const getHRZones = (maxHR: number) => {
  return {
    z1: [0.5 * maxHR, 0.6 * maxHR],
    z2: [0.6 * maxHR, 0.7 * maxHR],
    z3: [0.7 * maxHR, 0.8 * maxHR],
    z4: [0.8 * maxHR, 0.9 * maxHR],
    z5: [0.9 * maxHR, maxHR],
  };
};

export const progressionRate: Record<ExperienceLevel, number> = {
  beginner: 0.06,
  intermediate: 0.1,
  advanced: 0.14,
};

const ATL_DAYS = 7;
const CTL_DAYS = 42;

export const ATL_ALPHA = 2 / (ATL_DAYS + 1);
export const CTL_ALPHA = 2 / (CTL_DAYS + 1);
