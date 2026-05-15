import { z } from 'zod';

export const generatedPlanSchema = z.array(
  z.object({
    date: z.string(),
    type: z.string(),
    title: z.string(),
    description: z.string(),
    targetLoad: z.number().nonnegative(),
    targetDistance: z.number().nonnegative(),
    targetDuration: z.number().nonnegative(),
    instructions: z.string(),
  }),
);

export const coachInsightsSchema = z.object({
  insights: z.object({
    summary: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
    recommendations: z.array(z.string()),
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
