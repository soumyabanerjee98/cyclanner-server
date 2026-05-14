import { prisma } from '@/lib/prisma.js';
import {
  adjustForFatigue,
  estimateLoadFromDistance,
  generateWeeklyPlan,
  getTargetWeeklyLoad,
  getWeeksRemaining,
} from '@/utils/strava.util.js';
import {
  getValidAccessToken,
  syncActivity,
  updateTrainingState,
} from './strava.service.js';
import axios from 'axios';
import { experienceMultiplier } from '@/config/strava.config.js';
import { adjustPlanWithAI, generateCoachInsights } from './ai.service.js';

export const updateUserPhysiology = async (userId: string) => {
  // 1. Max HR from all activities
  const maxHrAgg = await prisma.activity.aggregate({
    where: {
      userId,
      maxHR: {
        not: null,
      },
    },
    _max: {
      maxHR: true,
    },
  });

  const computedMaxHR = maxHrAgg._max.maxHR || null;

  // 2. Fetch user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // 3. Auto resting HR only if missing
  let restingHR = user.restingHR;

  if (!restingHR) {
    const easyRide = await prisma.activity.findFirst({
      where: {
        userId,
        avgHR: {
          not: null,
        },
        zone: 'z1',
      },
      orderBy: {
        avgHR: 'asc',
      },
    });

    if (easyRide?.avgHR) {
      restingHR = Math.max(40, easyRide.avgHR - 10);
    }
  }

  // 4. Update user
  return prisma.user.update({
    where: { id: userId },
    data: {
      maxHR: computedMaxHR || user.maxHR,
      restingHR,
    },
  });
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
  const { atl, ctl, tsb } = await updateTrainingState(userId, new Date());

  let targetLoad;

  if (goal.type === 'distance' && goal.targetDistance) {
    targetLoad = estimateLoadFromDistance(goal.targetDistance);
  } else if (goal.type === 'event' && goal.eventDate) {
    const weeks = getWeeksRemaining(goal.eventDate);
    const targetEventLoad = stats.totalLoad * 1.5;

    const increment = (targetEventLoad - stats.totalLoad) / weeks;
    targetLoad = stats.totalLoad + increment;
  } else {
    targetLoad = getTargetWeeklyLoad(stats.totalLoad, goal.experienceLevel);
  }

  targetLoad *= experienceMultiplier[goal.experienceLevel];

  const adjustedLoad = adjustForFatigue(targetLoad, tsb);

  const plan = generateWeeklyPlan(adjustedLoad);

  return {
    currentLoad: stats.totalLoad,
    targetLoad,
    adjustedLoad,
    fatigue: atl,
    fitness: ctl,
    readiness: tsb,
    plan,
  };
};

export const getAICoachInsights = async (
  userId: string,
  goal: Goal,
  maxRetries: number = 0,
) => {
  const planData = await buildWeeklyPlan(userId, goal);
  const input: CoachInput = {
    currentLoad: planData.currentLoad,
    targetLoad: planData.targetLoad,
    fatigue: planData.fatigue,
    fitness: planData.fitness,
    readiness: planData.readiness,
    plan: planData.plan,
    goal,
  };
  const insights = await generateCoachInsights(input, maxRetries);
  return insights;
};

export const getAIPlanAdjustment = async (
  userId: string,
  goal: Goal,
  maxRetries: number = 0,
) => {
  const planData = await buildWeeklyPlan(userId, goal);
  const input: CoachInput = {
    currentLoad: planData.currentLoad,
    targetLoad: planData.targetLoad,
    fatigue: planData.fatigue,
    fitness: planData.fitness,
    readiness: planData.readiness,
    plan: planData.plan,
    goal,
  };
  const adjustments = await adjustPlanWithAI(input, maxRetries);
  return adjustments;
};

export const fetchActivitiesPreview = async (
  userId: string,
  {
    page = 1,
    perPage = 20,
  }: {
    page?: number | null;
    perPage?: number | null;
  },
) => {
  const token = await prisma.stravaToken.findFirst({
    where: { userId, isActive: true },
  });

  if (!token) throw new Error('Strava not connected');

  const valid = await getValidAccessToken(token);

  const { data } = await axios.get(
    'https://www.strava.com/api/v3/athlete/activities',
    {
      headers: {
        Authorization: `Bearer ${valid.accessToken}`,
      },
      params: {
        per_page: perPage,
        page,
      },
    },
  );

  const activities = data.map((a: any) => ({
    id: a.id.toString(),
    name: a.name,
    distance: a.distance,
    date: a.start_date,
  }));

  return {
    page,
    perPage,
    count: activities.length,
    hasNext: data.length === perPage,
    activities,
  };
};

export const getUserActivities = async (
  userId: string,
  {
    page = 1,
    perPage = 20,
    fromDate,
    toDate,
    zone,
  }: {
    page?: number;
    perPage?: number;
    fromDate?: string;
    toDate?: string;
    zone?: 'z1' | 'z2' | 'z3' | 'z4' | 'z5';
  },
) => {
  const skip = (page - 1) * perPage;

  const where: any = {
    userId,
    zone,
  };

  if (fromDate || toDate) {
    where.startDate = {};
    if (fromDate) where.startDate.gte = new Date(fromDate);
    if (toDate) where.startDate.lte = new Date(toDate);
  }

  const activities = await prisma.activity.findMany({
    where,
    orderBy: {
      startDate: 'desc', // latest first
    },
    skip,
    take: perPage,
  });

  const safeActivities = activities.map((a) => ({
    ...a,
    id: a.id.toString(),
  }));

  return {
    page,
    perPage,
    count: safeActivities.length,
    hasNext: safeActivities.length === perPage,
    activities: safeActivities,
  };
};

export const syncSelectedActivities = async (
  userId: string,
  activityIds: number[],
) => {
  const token = await prisma.stravaToken.findFirst({
    where: { userId, isActive: true },
  });

  const valid = await getValidAccessToken(token);
  let activityIdsToSync: number[] = [];
  for (const id of activityIds) {
    await syncActivity(id, valid.athleteId);
    activityIdsToSync.push(id);
  }

  return {
    message: 'Selected activities synced',
    activityIds: activityIdsToSync,
  };
};

export const deleteActivity = async (userId: string, activityId: string) => {
  const activity = await prisma.activity.findFirst({
    where: {
      id: BigInt(activityId),
      userId,
    },
  });

  if (!activity) {
    throw new Error('Activity not found');
  }

  const deletedActivity = await prisma.activity.delete({
    where: {
      id: BigInt(activityId),
    },
  });

  await updateUserPhysiology(userId);

  return { message: 'Activity deleted successfully', deletedActivity };
};
