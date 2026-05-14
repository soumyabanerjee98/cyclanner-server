import { z } from 'zod';

export const getDailyInsightsQuerySchema = z.object({
  date: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
});
