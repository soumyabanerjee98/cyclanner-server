import { z } from 'zod';

export const goalSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  customGoalRequirements: z.string().optional(),
});

export const getAIInsightsSchema = z.object({
  currentLoad: z.number().nonnegative(),
  targetLoad: z.number().nonnegative(),
  adjustedLoad: z.number().nonnegative(),
  fatigue: z.number().nonnegative(),
  fitness: z.number().nonnegative(),
  readiness: z.number().nonnegative(),
  plan: z.array(
    z.object({
      date: z.string(),
      type: z.string(),
      targetLoad: z.number().nonnegative(),
      targetDistance: z.number().nonnegative(),
      targetDuration: z.number().nonnegative(),
    }),
  ),
  retries: z.number().optional(),
});

export const syncActivitiesSchema = z.object({
  activityIds: z.array(z.number()),
});

export const activityQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 1)),

  perPage: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 20)),

  fromDate: z.string().optional(),
  toDate: z.string().optional(),

  zone: z.enum(['z1', 'z2', 'z3', 'z4', 'z5']).optional(),
});

export const previewActivitiesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 1)),
  perPage: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 20)),
});

export const deleteActivityQuerySchema = z.object({
  activityId: z.string().transform((val) => Number(val)),
});
