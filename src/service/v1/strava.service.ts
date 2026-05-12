import { prisma } from '@/lib/prisma.js';
import axios from 'axios';
import 'dotenv/config';

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
  return url;
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

  try {
    if (!token) {
      throw Error('No validated token found for athlete: ' + athleteId);
    }
    const response = await axios.get(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      },
    );

    const activity = response.data;

    await prisma.activity.upsert({
      where: { id: BigInt(activity.id) },
      update: {
        name: activity.name,
        distance: activity.distance,
        movingTime: activity.moving_time,
        avgHR: activity.average_heartrate ?? null,
        maxHR: activity.max_heartrate ?? null,
        elevationGain: activity.total_elevation_gain ?? null,
        startDate: new Date(activity.start_date),
      },
      create: {
        id: BigInt(activity.id),
        userId: token.userId,
        name: activity.name,
        distance: activity.distance,
        movingTime: activity.moving_time,
        avgHR: activity.average_heartrate ?? null,
        maxHR: activity.max_heartrate ?? null,
        elevationGain: activity.total_elevation_gain ?? null,
        startDate: new Date(activity.start_date),
      },
    });

    console.log('Activity synced: ', activity.id);

    return { activityId: activity.id };
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('Token invalid, refreshing and retrying...');

      token = await refreshAccessToken(token);

      const retry = await axios.get(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
          },
        },
      );

      const activity = retry.data;

      await prisma.activity.upsert({
        where: { id: BigInt(activity.id) },
        update: {
          name: activity.name,
          distance: activity.distance,
          movingTime: activity.moving_time,
          avgHR: activity.average_heartrate ?? null,
          maxHR: activity.max_heartrate ?? null,
          elevationGain: activity.total_elevation_gain ?? null,
          startDate: new Date(activity.start_date),
        },
        create: {
          id: BigInt(activity.id),
          userId: token.userId,
          name: activity.name,
          distance: activity.distance,
          movingTime: activity.moving_time,
          avgHR: activity.average_heartrate ?? null,
          maxHR: activity.max_heartrate ?? null,
          elevationGain: activity.total_elevation_gain ?? null,
          startDate: new Date(activity.start_date),
        },
      });

      console.log('Activity synced after retry: ', activity.id);

      return { activityId: activity.id };
    } else {
      throw Error('Sync error: ' + error.message);
    }
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
