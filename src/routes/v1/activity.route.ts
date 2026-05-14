import { activityController } from '@/controller/index.js';
import { validate } from '@/middleware/validate.middleware.js';
import {
  activityQuerySchema,
  deleteActivityQuerySchema,
  getAIAdjustmentSchema,
  getAIInsightsSchema,
  goalSchema,
  previewActivitiesQuerySchema,
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
  validate({ query: previewActivitiesQuerySchema }),
  activityController.previewActivities,
);
router.get(
  '/get-activities',
  validate({ query: activityQuerySchema }),
  activityController.getActivities,
);
router.post(
  '/sync-activities',
  validate({ body: syncActivitiesSchema }),
  activityController.syncActivities,
);
router.delete(
  '/delete-activity/:activityId',
  validate({ params: deleteActivityQuerySchema }),
  activityController.removeActivity,
);

export default router;
