import { goalService } from '@/service/index.js';
import type { Request, Response } from 'express';

export const createGoal = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const userId = req.user.userId;
    const {
      currentLoad,
      targetLoad,
      adjustedLoad,
      fatigue,
      fitness,
      readiness,
      plan,
      startDate,
      endDate,
      experienceLevel,
      customGoalRequest,
    } = req.body;

    const result = await goalService.createGoal(userId, {
      currentLoad,
      targetLoad,
      adjustedLoad,
      fatigue,
      fitness,
      readiness,
      plan,
      startDate,
      endDate,
      experienceLevel,
      customGoalRequest,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getCurrentGoal = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const userId = req.user.userId;
    const result = await goalService.getCurrentGoal(userId);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const evaluateGoalCompletion = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const goalId = req.params.goalId as string;
    const result = await goalService.evaluateGoalCompletion(goalId);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};
