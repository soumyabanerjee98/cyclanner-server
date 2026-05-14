import { stravaController } from '@/controller/index.js';
import { authMiddleware } from '@/middleware/jwt.middleware.js';
import { validate } from '@/middleware/validate.middleware.js';
import { newConnectionQuerySchema } from '@/validator/strava.validator.js';
import { Router } from 'express';

const router = Router();

router.get(
  '/connect',
  authMiddleware,
  validate({ query: newConnectionQuerySchema }),
  stravaController.connectStrava,
);
router.delete('/disconnect', authMiddleware, stravaController.disconnectStrava);
router.get('/callback', stravaController.stravaCallback);
router.all('/webhook', stravaController.handleWebhook);

export default router;
