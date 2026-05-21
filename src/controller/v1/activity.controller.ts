import {
  buildPlan,
  deleteActivity,
  fetchActivitiesPreview,
  getAICoachInsights,
  getUserActivities,
  syncSelectedActivities,
} from '@/service/v1/activity.service.js';
import type { Request, Response } from 'express';

export const getPlan = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const userId = req.user.userId;

    const goal = req.body;

    const plan = await buildPlan(userId, goal);

    return res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const getAIInsights = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const { retries, ...input } = req.body;

    const insights = await getAICoachInsights(input, retries);
    return res.json(insights);
  } catch (error) {
    next(error);
  }
};

export const previewActivities = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const userId = req.user.userId;

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
  } catch (error) {
    next(error);
  }
};

export const getActivities = async (req: any, res: any, next: Function) => {
  try {
    const userId = req.user.userId;
    const query = req.query;
    const page = Number(query.page) || 1;
    const perPage = Number(query.perPage) || 20;
    const { fromDate, toDate, zone } = query;

    const result = await getUserActivities(userId, {
      page,
      perPage,
      fromDate,
      toDate,
      zone,
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const syncActivities = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const userId = req.user.userId;

    const { activityIds } = req.body;
    const result = await syncSelectedActivities(userId, activityIds);

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const removeActivity = async (
  req: Request & { user?: any },
  res: Response,
  next: Function,
) => {
  try {
    const userId = req.user.userId;
    const { activityId } = req.params;
    const result = await deleteActivity(userId, activityId as string);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};
