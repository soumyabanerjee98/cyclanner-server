import { goalController } from '@/controller/index.js';
import { validate } from '@/middleware/validate.middleware.js';
import { goalInputSchema } from '@/validator/goal.validator.js';
import { Router } from 'express';

const router = Router();

router.post(
  '/create-goal',
  validate({ body: goalInputSchema }),
  goalController.createGoal,
);

router.get('/current-goal', goalController.getCurrentGoal);

export default router;
