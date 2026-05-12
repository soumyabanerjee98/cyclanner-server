import { prisma } from '@/lib/prisma.js';
import {
  adjustForFatigue,
  generateWeeklyPlan,
  getTargetWeeklyLoad,
} from '@/utils/strava.util.js';

export const calculateFatigue = async (userId: string) => {
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startDate: { gte: last7Days },
    },
  });

  return activities.reduce((sum, a) => sum + (a.trainingLoad || 0), 0);
};

export const getWeeklyStats = async (userId: string) => {
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startDate: { gte: last7Days },
    },
  });

  const stats: StravaStats = {
    totalLoad: 0,
    zoneDistribution: { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 },
  };

  for (const a of activities) {
    stats.totalLoad += a.trainingLoad || 0;

    if (a.zone) {
      stats.zoneDistribution[a.zone as keyof typeof stats.zoneDistribution] +=
        a.trainingLoad || 0;
    }
  }

  return stats;
};

export const buildWeeklyPlan = async (userId: string, goal: Goal) => {
  const stats = await getWeeklyStats(userId);
  const fatigue = await calculateFatigue(userId);

  const targetLoad = getTargetWeeklyLoad(stats.totalLoad, goal.experienceLevel);

  const adjustedLoad = adjustForFatigue(targetLoad, fatigue);

  const plan = generateWeeklyPlan(adjustedLoad);

  return {
    currentLoad: stats.totalLoad,
    targetLoad,
    adjustedLoad,
    fatigue,
    plan,
  };
};
