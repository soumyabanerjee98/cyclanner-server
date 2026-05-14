import { prisma } from '@/lib/prisma.js';
import {
  calculateTrainingLoad,
  classifyIntensity,
} from '@/utils/strava.util.js';
import axios from 'axios';
import 'dotenv/config';

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

export const computeActivityMetrics = (activity: StravaActivity) => {
  let zone: string | null = null;
  let trainingLoad: number | null = null;

  const durationMin = activity.moving_time ? activity.moving_time / 60 : 0;

  //  1. HR (best)
  if (activity.average_heartrate && activity.max_heartrate) {
    zone = classifyIntensity(
      activity.average_heartrate,
      activity.max_heartrate,
    );

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

export const updateGoalAfterActivity = async (
  userId: string,
  activityDate: Date,
  previousLoad: number,
  newLoad: number,
) => {
  const deltaLoad = newLoad - previousLoad;

  if (!deltaLoad) return;

  const goal = await prisma.goal.findFirst({
    where: {
      userId,
      weekStart: { lte: activityDate },
      weekEnd: { gte: activityDate },
    },
  });

  if (!goal) return;

  const updatedLoad = goal.currentLoad + deltaLoad;

  let status: string = 'on_track';

  if (updatedLoad > goal.targetLoad * 1.2) {
    status = 'overtrained';
  } else if (updatedLoad < goal.targetLoad * 0.8) {
    status = 'undertrained';
  }

  await prisma.goal.update({
    where: { id: goal.id },
    data: {
      currentLoad: updatedLoad,
      fatigue: updatedLoad,
      status,
    },
  });
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
  console.log('Strava Callback: ', { code, userId });

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
    throw new Error('This Strava account is already linked to another user.');
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

  if (object_type !== 'activity') throw Error('Not an activity!');

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
    throw Error('No token found for athlete: ' + athleteId);
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

    const { zone, trainingLoad, source } = computeActivityMetrics(activity);

    console.log(
      zone,
      trainingLoad,
      source,
      'computed metrics for activity: ',
      activity.id,
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

    //  Update goal (delta-safe)
    await updateGoalAfterActivity(
      token?.userId || '',
      activityDate,
      previousLoad,
      newLoad,
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

    throw Error('Sync error: ' + error.message);
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
