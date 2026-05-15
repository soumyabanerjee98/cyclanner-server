import { insightService } from '@/service/index.js';
import type { Request, Response } from 'express';

export const createDailyInsight = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const userId = req.user.userId;
    const date = new Date(req.query.date as string);

    const result = await insightService.getDailyInsights(userId, date);

    return res.json(result);
  } catch (error) {
    next(error);
  }
};
