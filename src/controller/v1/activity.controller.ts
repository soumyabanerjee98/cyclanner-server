import {
  buildWeeklyPlan,
  deleteActivity,
  fetchActivitiesPreview,
  getAICoachInsights,
  getAIPlanAdjustment,
  getUserActivities,
  syncSelectedActivities,
} from '@/service/v1/activity.service.js';
import type { Request, Response } from 'express';

export const getWeeklyPlan = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;

  const goal = req.body;

  const plan = await buildWeeklyPlan(userId, goal);

  return res.json(plan);
};

export const getAIInsights = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;
  const { retries, ...goal } = req.body;

  const insights = await getAICoachInsights(userId, goal, retries);
  return res.json(insights);
};

export const getAIAdjustment = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;
  const { retries, ...goal } = req.body;
  const adjustments = await getAIPlanAdjustment(userId, goal, retries);
  return res.json(adjustments);
};

export const previewActivities = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;

  const { page: pageQuery, perPage: perPageQuery } = req.query;
  const page = Array.isArray(pageQuery)
    ? Number(pageQuery[0])
    : typeof pageQuery === 'string'
      ? Number(pageQuery)
      : null;
  const perPage = Array.isArray(perPageQuery)
    ? Number(perPageQuery[0])
    : typeof perPageQuery === 'string'
      ? Number(perPageQuery)
      : null;

  const plan = await fetchActivitiesPreview(userId, {
    page,
    perPage,
  });

  return res.json(plan);
};

export const getActivities = async (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const query = req.query;
    const page = Number(query.page) || 1;
    const perPage = Number(query.perPage) || 20;
    const { fromDate, toDate } = query;

    const result = await getUserActivities(userId, {
      page,
      perPage,
      fromDate,
      toDate,
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const syncActivities = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;

  const { activityIds } = req.body;
  const result = await syncSelectedActivities(userId, activityIds);

  return res.json(result);
};

export const removeActivity = async (
  req: Request & { user?: any },
  res: Response,
) => {
  const userId = req.user.id;
  const { activityId } = req.params;
  const result = await deleteActivity(userId, activityId as string);
  return res.json(result);
};
