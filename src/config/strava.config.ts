export const getHRZones = (maxHR: number) => {
  return {
    z1: [0.5 * maxHR, 0.6 * maxHR],
    z2: [0.6 * maxHR, 0.7 * maxHR],
    z3: [0.7 * maxHR, 0.8 * maxHR],
    z4: [0.8 * maxHR, 0.9 * maxHR],
    z5: [0.9 * maxHR, 1.0 * maxHR],
  };
};

export const intensityFactor = {
  z1: 1,
  z2: 2,
  z3: 3,
  z4: 4,
  z5: 5,
};

export const progressionRate = {
  beginner: 0.05, // 5%
  intermediate: 0.08, // 8%
  advanced: 0.1, // 10%
};
