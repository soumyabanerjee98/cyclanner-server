import { insightController } from '@/controller/index.js';
import { validate } from '@/middleware/validate.middleware.js';
import { getDailyInsightsQuerySchema } from '@/validator/insight.validator.js';
import { Router } from 'express';

const router = Router();

router.get(
  '/get-insight',
  validate({ query: getDailyInsightsQuerySchema }),
  insightController.createDailyInsight,
);

export default router;
