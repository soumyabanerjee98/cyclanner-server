import { z } from 'zod';

export const adjustedPlanSchema = z.object({
  adjustedPlan: z.array(
    z.object({
      day: z.string(),
      type: z.string(),
      load: z.number(),
    }),
  ),
});

export const coachInsightsSchema = z.object({
  insights: z.object({
    summary: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
    issues: z.array(z.string()),
    recommendations: z.array(z.string()),
    adjustments: z.array(z.string()),
  }),
});
