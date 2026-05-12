import { z } from 'zod';

export const goalSchema = z.object({
  type: z.enum(['distance', 'event']),
  targetDistance: z.number().optional(),
  eventDate: z.string().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
});
