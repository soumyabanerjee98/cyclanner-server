import { z } from 'zod';

export const getWeeklySummaryQuerySchema = z.object({
  date: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
});

export const getWeeklySummaryInsightParamsSchema = z.object({
  summaryId: z.string(),
});
