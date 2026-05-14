import { positive, z } from 'zod';

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

export const dailyInsightsSchema = z.object({
  fatigueScore: z.number(),
  strainScore: z.number(),
  commentary: z.string(),
});

export const weeklyInsightsSchema = z.object({
  summary: z.string(),
  positives: z.array(z.string()),
  issues: z.array(z.string()),
  currentState: z.string(),
  recommendations: z.array(z.string()),
});
