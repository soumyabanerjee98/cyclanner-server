import { z } from 'zod';

export const goalSchema = z.object({
  type: z.enum(['distance', 'event']),
  targetDistance: z.number().optional(),
  eventDate: z.string().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  aiFeedback: z.boolean().optional(),
  adjustPlanWithAI: z.boolean().optional(),
  maxAIRetries: z.number().optional(),
});

export const syncActivitiesSchema = z.object({
  activityIds: z.array(z.number()),
});

export const activityParamsSchema = z.object({
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

export const previewActivitiesParamsSchema = z.object({
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
