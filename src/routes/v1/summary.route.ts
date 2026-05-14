import { summaryController } from '@/controller/index.js';
import { validate } from '@/middleware/validate.middleware.js';
import {
  getWeeklySummaryInsightParamsSchema,
  getWeeklySummaryQuerySchema,
} from '@/validator/summary.validator.js';
import { Router } from 'express';

const router = Router();

router.get(
  '/get-summary',
  validate({ query: getWeeklySummaryQuerySchema }),
  summaryController.getWeeklySummary,
);

router.get(
  '/get-ai-insight/:summaryId',
  validate({ params: getWeeklySummaryInsightParamsSchema }),
  summaryController.getWeeklySummaryInsight,
);

export default router;
