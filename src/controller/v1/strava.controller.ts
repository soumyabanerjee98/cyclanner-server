import { verifyStravaSignature } from '@/lib/verifyStravaSign.js';
import { stravaService } from '@/service/index.js';
import { serialize } from '@/utils/serialise.util.js';
import type { Request, Response } from 'express';

export const connectStrava = (req: Request & { user?: any }, res: Response) => {
  const userId = req.user.userId;
  const { newConnection, resetData } = req.query;
  const result = stravaService.connectStrava({
    userId,
    newConnection: newConnection ? Boolean(newConnection) : true,
    resetData: resetData ? Boolean(resetData) : false,
  });
  return res.json(result);
};

export const stravaCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
  const { userId, newConnection, resetData } = decoded;
  const result = await stravaService.stravaCallback({
    code: code as string,
    userId,
    newConnection,
    resetData,
  });
  return res.json(serialize(result));
};

export const handleWebhook = async (req: any, res: any) => {
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'];
    console.log('Strava Event Webhook Subscription: ', challenge);

    return res.json({ 'hub.challenge': challenge });
  }

  const signature = req.headers['x-strava-signature'];

  if (!signature || !req.rawBody) {
    return res.status(400).send('Missing signature');
  }

  const isValid = verifyStravaSignature(req.rawBody, signature);

  if (!isValid) {
    console.error('Invalid Strava signature');
    return res.status(403).send('Invalid signature');
  }

  const event = req.body;

  const activityId = await stravaService.processWebhookEvent(event);

  return res.json(activityId);
};

export const disconnectStrava = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;

  const update = await stravaService.disconnectStrava({ userId });

  return res.json(update);
};
