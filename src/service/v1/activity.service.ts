import { prisma } from '@/lib/prisma.js';
import {
  getValidAccessToken,
  syncActivity,
  updateTrainingState,
} from './strava.service.js';
import axios from 'axios';
import { generateCoachInsights, generatePlanWithAI } from './ai.service.js';
import { deriveTrainingState } from '@/utils/strava.util.js';
import AppError from '@/handler/error.handler.js';
import { activityQueue } from '@/queues/activity.queue.js';

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
    throw new AppError('User not found', 404);
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

export const getMonthlyStats = async (userId: string) => {
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startDate: {
        gte: last30Days,
      },
    },
  });

  const stats: StravaStats = {
    totalLoad: 0,

    zoneDistribution: {
      z1: 0,
      z2: 0,
      z3: 0,
      z4: 0,
      z5: 0,
    },
  };

  for (const activity of activities) {
    const load = activity.trainingLoad || 0;

    stats.totalLoad += load;

    if (activity.zone && activity.zone in stats.zoneDistribution) {
      stats.zoneDistribution[
        activity.zone as keyof typeof stats.zoneDistribution
      ] += load;
    }
  }

  return stats;
};

export const buildPlan = async (userId: string, goal: Goal) => {
  const stats = await getMonthlyStats(userId);
  const { atl, ctl, tsb } = await updateTrainingState(userId, new Date());

  const metrics = deriveTrainingState({
    currentLoad: stats.totalLoad,
    atl,
    ctl,
    tsb,
    experienceLevel: goal.experienceLevel,
  });

  const aiGeneratedPlan = await generatePlanWithAI(
    {
      metrics,
      startDate: goal.startDate,
      endDate: goal.endDate,
      experienceLevel: goal.experienceLevel,
      customGoalRequest: goal.customGoalRequirements,
    },
    3,
  );

  if (aiGeneratedPlan.type === 'string')
    throw new AppError(
      'AI failed to generate a valid plan: ' + aiGeneratedPlan.value,
    );
  const plan = aiGeneratedPlan.value;
  return { ...metrics, plan };
};

export const getAICoachInsights = async (
  coachInput: CoachInput,
  maxRetries: number = 0,
) => {
  const insights = await generateCoachInsights(coachInput, maxRetries);
  return insights;
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

  if (!token) throw new AppError('Strava not connected', 400);

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
    await activityQueue.add(
      'sync-activity',
      {
        activityId: id.toString(),
        athleteId: valid.athleteId.toString(),
      },
      { jobId: `sync-activity-${id.toString()}` },
    );
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
    throw new AppError('Activity not found', 404);
  }

  const deletedActivity = await prisma.activity.delete({
    where: {
      id: BigInt(activityId),
    },
  });

  await updateUserPhysiology(userId);

  return { message: 'Activity deleted successfully', deletedActivity };
};
