import { summaryController } from '@/controller/index.js';
import { validate } from '@/middleware/validate.middleware.js';
import {
  getGoalSummaryInsightParamsSchema,
  getGoalSummaryQuerySchema,
} from '@/validator/summary.validator.js';
import { Router } from 'express';

const router = Router();

router.get(
  '/get-summary',
  validate({ query: getGoalSummaryQuerySchema }),
  summaryController.getGoalSummary,
);

router.get(
  '/get-summary-insight/:summaryId',
  validate({ params: getGoalSummaryInsightParamsSchema }),
  summaryController.getGoalSummaryInsight,
);

export default router;
