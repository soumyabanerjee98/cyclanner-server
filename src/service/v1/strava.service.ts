import { prisma } from '@/lib/prisma.js';
import axios from 'axios';
import 'dotenv/config';

export const connectStrava = ({ userId }: { userId: string }) => {
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
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
}: {
  code: string;
  userId: string;
}) => {
  console.log('Strava Callback: code: ' + code + ' userId: ' + userId);
  const response = await axios.post('https://www.strava.com/oauth/token', {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });

  const data = response.data;

  const update = await prisma.stravaToken.upsert({
    where: { userId },
    update: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      athleteId: data.athlete.id,
    },
    create: {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      athleteId: data.athlete.id,
    },
  });

  return { update };
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

const syncActivity = async (activityId: number, athleteId: number) => {
  let token = await prisma.stravaToken.findFirst({
    where: { athleteId: BigInt(athleteId) },
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

const deleteActivity = async (activityId: number) => {
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
