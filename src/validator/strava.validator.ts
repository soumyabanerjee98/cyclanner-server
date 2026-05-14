import { z } from 'zod';

export const newConnectionParamsSchema = z.object({
  newConnection: z.string().optional(),
  resetData: z.string().optional(),
});
