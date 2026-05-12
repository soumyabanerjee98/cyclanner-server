import { buildWeeklyPlan } from '@/service/v1/activity.service.js';
import type { Request, Response } from 'express';

export const getWeeklyPlan = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;

  const goal = req.body; // later validate this

  const plan = await buildWeeklyPlan(userId, goal);

  return res.json(plan);
};
