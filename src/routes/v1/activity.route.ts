import { activityController } from '@/controller/index.js';
import { validate } from '@/middleware/validate.middleware.js';
import { goalSchema } from '@/validator/plan.validator.js';
import { Router } from 'express';

const router = Router();

router.post(
  '/get-weekly-plan',
  validate(goalSchema),
  activityController.getWeeklyPlan,
);

export default router;
