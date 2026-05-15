import { ATL_ALPHA, CTL_ALPHA } from '@/config/strava.config.js';
import { prisma } from '@/lib/prisma.js';
import {
  calculateTrainingLoad,
  classifyIntensity,
} from '@/utils/strava.util.js';
import axios from 'axios';
import 'dotenv/config';
import { updateUserPhysiology } from './activity.service.js';
import AppError from '@/handler/error.handler.js';

export const fetchStravaActivity = async (
  activityId: number,
  accessToken: string,
) => {
  const { data } = await axios.get(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return data;
};

export const computeActivityMetrics = (
  activity: StravaActivity,
  userMaxHr: number | null,
) => {
  let zone: string | null = null;
  let trainingLoad: number | null = null;

  const durationMin = activity.moving_time ? activity.moving_time / 60 : 0;

  //  1. HR (best)
  const maxHr = userMaxHr ?? activity.max_heartrate;

  if (activity.average_heartrate && maxHr !== undefined) {
    zone = classifyIntensity(activity.average_heartrate, maxHr);

    trainingLoad = calculateTrainingLoad(activity.moving_time, zone);

    return { zone, trainingLoad, source: 'hr' };
  }

  //  2. Suffer score (FIXED)
  if (activity.suffer_score && durationMin > 0) {
    const intensityPerMin = activity.suffer_score / durationMin;

    if (intensityPerMin < 0.5) zone = 'z1';
    else if (intensityPerMin < 1.5) zone = 'z2';
    else if (intensityPerMin < 2.5) zone = 'z3';
    else if (intensityPerMin < 4) zone = 'z4';
    else zone = 'z5';

    trainingLoad = calculateTrainingLoad(activity.moving_time, zone);

    return { zone, trainingLoad, source: 'suffer_score' };
  }

  //  3. Speed fallback
  if (activity.average_speed && activity.moving_time) {
    const speed = activity.average_speed;

    if (speed < 4) zone = 'z1';
    else if (speed < 6) zone = 'z2';
    else if (speed < 8) zone = 'z3';
    else if (speed < 10) zone = 'z4';
    else zone = 'z5';

    trainingLoad = calculateTrainingLoad(activity.moving_time, zone);

    return { zone, trainingLoad, source: 'speed' };
  }

  //  4. Time fallback
  if (activity.moving_time) {
    zone = 'z2';
    trainingLoad = calculateTrainingLoad(activity.moving_time, zone);

    return { zone, trainingLoad, source: 'time' };
  }

  return { zone: null, trainingLoad: null, source: 'none' };
};

export const updateGoalAndPlanAfterActivity = async (
  userId: string,
  activityDate: Date,
  previousLoad: number,
  newLoad: number,
  atl?: number,
  ctl?: number,
  tsb?: number,
) => {
  const deltaLoad = newLoad - previousLoad;

  // No change
  if (deltaLoad === 0) return;

  // 1. Find active goal
  const goal = await prisma.goal.findFirst({
    where: {
      userId,
      startDate: {
        lte: activityDate,
      },
      endDate: {
        gte: activityDate,
      },
      isActive: true,
    },
    include: {
      plan: true,
    },
  });

  if (!goal) return;

  // 2. Update current weekly load
  const updatedCurrentLoad = goal.currentLoad + deltaLoad;

  /**
   * FATIGUE MODEL
   *
   * fatigue = ATL
   * freshness = TSB
   * fitness = CTL
   */

  // 3. Goal status logic
  let status: 'on_track' | 'overtrained' | 'undertrained' = 'on_track';

  /**
   * Better logic:
   * Use ATL/TSB primarily
   */

  if (tsb !== undefined) {
    if (tsb < -20) {
      status = 'overtrained';
    } else if (updatedCurrentLoad < goal.adjustedLoad * 0.8) {
      status = 'undertrained';
    }
  } else {
    /**
     * FALLBACK:
     * load ratio based
     */

    if (updatedCurrentLoad > goal.adjustedLoad * 1.2) {
      status = 'overtrained';
    } else if (updatedCurrentLoad < goal.adjustedLoad * 0.8) {
      status = 'undertrained';
    }
  }

  // 4. Update goal (delta-safe)

  await prisma.goal.update({
    where: {
      id: goal.id,
    },

    data: {
      currentLoad: updatedCurrentLoad,

      fatigue: atl ?? goal.fatigue,
      fitness: ctl ?? goal.fitness,
      readiness: tsb ?? goal.readiness,

      status,
    },
  });

  const dayStart = new Date(activityDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(activityDate);
  dayEnd.setHours(23, 59, 59, 999);

  const planSession = await prisma.plan.findFirst({
    where: {
      goalId: goal.id,

      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
  });

  if (!planSession) {
    return;
  }

  const updatedActualLoad = (planSession.actualLoad || 0) + deltaLoad;

  // =========================
  // AUTO COMPLETE SESSION
  // =========================

  const completed = updatedActualLoad >= planSession.targetLoad * 0.7;

  await prisma.plan.update({
    where: {
      id: planSession.id,
    },

    data: {
      actualLoad: updatedActualLoad,

      completed,

      completedAt: completed ? new Date() : null,
    },
  });
};

export const updateTrainingState = async (userId: string, date: Date) => {
  // 1. Get today's total load
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startDate: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lte: new Date(date.setHours(23, 59, 59, 999)),
      },
    },
  });

  const todayLoad = activities.reduce(
    (sum, a) => sum + (a.trainingLoad || 0),
    0,
  );

  // 2. Get latest state
  const lastGoal = await prisma.goal.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const prevATL = lastGoal?.fatigue || 0;
  const prevCTL = lastGoal?.fitness || 0;

  const atl = prevATL + ATL_ALPHA * (todayLoad - prevATL);
  const ctl = prevCTL + CTL_ALPHA * (todayLoad - prevCTL);
  const tsb = ctl - atl;

  return { atl, ctl, tsb, todayLoad };
};

export const connectStrava = ({
  userId,
  newConnection = true,
  resetData = false,
}: {
  userId: string;
  newConnection?: boolean;
  resetData?: boolean;
}) => {
  const state = Buffer.from(
    JSON.stringify({ userId, newConnection, resetData }),
  ).toString('base64');
  const url =
    `https://www.strava.com/oauth/authorize` +
    `?client_id=${process.env.STRAVA_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${process.env.STRAVA_REDIRECT_URI}` +
    `&scope=activity:read_all` +
    `&state=${state}`;
  console.log('Strava Connection URL: ' + url);
  return { url };
};

export const stravaCallback = async ({
  code,
  userId,
  newConnection,
  resetData,
}: {
  code: string;
  userId: string;
  newConnection: boolean;
  resetData: boolean;
}) => {
  console.log('Strava Callback: ', { code, userId, newConnection, resetData });

  const response = await axios.post('https://www.strava.com/oauth/token', {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });

  const data = response.data;
  const athleteId = BigInt(data.athlete.id);

  const existingAthlete = await prisma.stravaToken.findFirst({
    where: {
      athleteId,
      isActive: true,
      NOT: { userId },
    },
  });

  if (existingAthlete) {
    throw new AppError(
      'This Strava account is already linked to another user.',
      400,
    );
  }

  if (newConnection) {
    await prisma.stravaToken.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    if (resetData) {
      await prisma.activity.deleteMany({
        where: { userId },
      });
    }
  }

  const existingToken = await prisma.stravaToken.findFirst({
    where: {
      userId,
      athleteId,
    },
  });

  let tokenRecord;

  if (existingToken) {
    tokenRecord = await prisma.stravaToken.update({
      where: { id: existingToken.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        isActive: true,
      },
    });
  } else {
    tokenRecord = await prisma.stravaToken.create({
      data: {
        userId,
        athleteId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        isActive: true,
      },
    });
  }

  return { update: tokenRecord };
};

export const processWebhookEvent = async (event: StravaEvent) => {
  console.log('Strava Event Webhook Call: ', event);

  const { aspect_type, object_type, object_id, owner_id } = event;

  if (object_type !== 'activity') throw new AppError('Not an activity!', 400);

  switch (aspect_type) {
    case 'create':
    case 'update':
      return await syncActivity(object_id, owner_id);

    case 'delete':
      return await deleteActivity(object_id);
  }
};

export const syncActivity = async (activityId: number, athleteId: number) => {
  let token = await prisma.stravaToken.findFirst({
    where: { athleteId: BigInt(athleteId), isActive: true },
  });

  if (!token) {
    throw new AppError('No token found for athlete: ' + athleteId, 404);
  }

  token = await getValidAccessToken(token);

  const executeSync = async (accessToken: string) => {
    const activity: StravaActivity = await fetchStravaActivity(
      activityId,
      accessToken,
    );

    if (activity.type !== 'Ride') {
      console.log('Skipping non-ride activity: ', activity.id);
      return { activityId: activity.id, skipped: true };
    }

    const user = await prisma.user.findUnique({
      where: {
        id: token?.userId || '',
      },
    });

    const { zone, trainingLoad } = computeActivityMetrics(
      activity,
      user?.maxHR || null,
    );

    const activityDate = new Date(activity.start_date);

    //  Get existing activity (for delta)
    const existing = await prisma.activity.findUnique({
      where: { id: BigInt(activity.id) },
    });

    const previousLoad = existing?.trainingLoad || 0;
    const newLoad = trainingLoad || 0;

    //  Upsert activity
    await prisma.activity.upsert({
      where: { id: BigInt(activity.id) },
      update: {
        name: activity.name,
        type: activity.type,
        distance: activity.distance,
        movingTime: activity.moving_time,
        elapsedTime: activity.elapsed_time,
        avgHR: activity.average_heartrate ?? null,
        maxHR: activity.max_heartrate ?? null,
        elevationGain: activity.total_elevation_gain ?? null,
        startDate: activityDate,
        timezone: activity.timezone,
        zone,
        trainingLoad,
      },
      create: {
        id: BigInt(activity.id),
        userId: token?.userId || '',
        name: activity.name,
        type: activity.type,
        distance: activity.distance,
        movingTime: activity.moving_time,
        elapsedTime: activity.elapsed_time,
        avgHR: activity.average_heartrate ?? null,
        maxHR: activity.max_heartrate ?? null,
        elevationGain: activity.total_elevation_gain ?? null,
        startDate: activityDate,
        timezone: activity.timezone,
        zone,
        trainingLoad,
      },
    });
    await updateUserPhysiology(token?.userId || '');
    const { atl, ctl, tsb } = await updateTrainingState(
      token?.userId || '',
      activityDate,
    );

    //  Update goal (delta-safe)
    await updateGoalAndPlanAfterActivity(
      token?.userId || '',
      activityDate,
      previousLoad,
      newLoad,
      atl,
      ctl,
      tsb,
    );

    console.log('Activity synced: ', activity.id);

    return { activityId: activity.id };
  };

  try {
    return await executeSync(token?.accessToken || '');
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('Token expired, refreshing...');

      token = await refreshAccessToken(token);

      return await executeSync(token.accessToken);
    }

    throw new AppError('Sync error: ' + error.message);
  }
};

export const deleteActivity = async (activityId: number) => {
  await prisma.activity.deleteMany({
    where: { id: BigInt(activityId) },
  });

  console.log('Activity deleted: ', activityId);

  return { activityId };
};

export const getValidAccessToken = async (token: any) => {
  const now = Math.floor(Date.now() / 1000);

  if (token.expiresAt <= now + 60) {
    console.log('Strava Token expired, refreshing...');
    return await refreshAccessToken(token);
  }

  return token;
};

export const refreshAccessToken = async (token: any) => {
  const response = await axios.post('https://www.strava.com/oauth/token', {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
  });

  const data = response.data;

  const updated = await prisma.stravaToken.update({
    where: { id: token.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
    },
  });

  return updated;
};

export const disconnectStrava = async ({ userId }: { userId: string }) => {
  const updated = await prisma.stravaToken.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  return updated;
};
