import { z } from 'zod';

export const newConnectionQuerySchema = z.object({
  newConnection: z.string().optional(),
  resetData: z.string().optional(),
});
