import { stravaService } from '@/service/index.js';
import { serialize } from '@/utils/serialise.util.js';
import type { Request, Response } from 'express';
import path from 'path';

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
  try {
    await stravaService.stravaCallback({
      code: code as string,
      userId,
      newConnection,
      resetData,
    });
    return res.sendFile(
      path.join(
        process.cwd(),
        'src/template/html/strava_callback_success.html',
      ),
    );
  } catch {
    return res.sendFile(
      path.join(
        process.cwd(),
        'src/template/html/strava_callback_failure.html',
      ),
    );
  }
};

export const handleWebhook = async (req: any, res: any) => {
  if (req.method === 'GET') {
    const challenge = req.query['hub.challenge'];
    console.log('Strava Event Webhook Subscription: ', challenge);

    return res.json({ 'hub.challenge': challenge });
  }

  const signature = req.headers['x-strava-signature'];

  if (!signature) {
    console.error('Missing Strava signature for webhook event');
    return res.status(400).send('Missing signature');
  }

  //  rawBody is Buffer because of express.raw()
  const rawBody = req.body;

  // const isValid = verifyStravaSignature(rawBody, signature);

  // if (!isValid) {
  //   console.error('Invalid Strava signature for webhook event');
  //   return res.status(403).send('Invalid signature');
  // }

  //  Parse JSON manually
  const event = JSON.parse(rawBody.toString());

  const result = await stravaService.processWebhookEvent(event);

  return res.json({ success: true, result });
};

export const disconnectStrava = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;

  const update = await stravaService.disconnectStrava({ userId });

  return res.json(update);
};
