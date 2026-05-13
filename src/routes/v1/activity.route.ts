import { activityController } from '@/controller/index.js';
import { validate } from '@/middleware/validate.middleware.js';
import {
  activityParamsSchema,
  deleteActivityQuerySchema,
  getAIAdjustmentSchema,
  getAIInsightsSchema,
  goalSchema,
  previewActivitiesParamsSchema,
  syncActivitiesSchema,
} from '@/validator/activity.validator.js';
import { Router } from 'express';

const router = Router();

router.post(
  '/get-weekly-plan',
  validate({ body: goalSchema }),
  activityController.getWeeklyPlan,
);

router.post(
  '/get-ai-insights',
  validate({ body: getAIInsightsSchema }),
  activityController.getAIInsights,
);

router.post(
  '/get-ai-adjustment',
  validate({ body: getAIAdjustmentSchema }),
  activityController.getAIAdjustment,
);

router.get(
  '/preview-strava-activities',
  validate({ params: previewActivitiesParamsSchema }),
  activityController.previewActivities,
);
router.get(
  '/get-activities',
  validate({ params: activityParamsSchema }),
  activityController.getActivities,
);
router.post(
  '/sync-activities',
  validate({ body: syncActivitiesSchema }),
  activityController.syncActivities,
);
router.delete(
  '/delete-activity/:activityId',
  validate({ query: deleteActivityQuerySchema }),
  activityController.removeActivity,
);

export default router;
