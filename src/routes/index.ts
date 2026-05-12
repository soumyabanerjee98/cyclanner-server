import { authMiddleware } from '@/middleware/jwt.middleware.js';
import authRouter from '@/routes/v1/auth.route.js';
import stravaRouter from '@/routes/v1/strava.route.js';
import activityRouter from '@/routes/v1/activity.route.js';
import { Router } from 'express';

const router = Router();

router.use('/auth', authRouter);
router.use('/strava', stravaRouter);
router.use('/activity', authMiddleware, activityRouter);

export default router;
