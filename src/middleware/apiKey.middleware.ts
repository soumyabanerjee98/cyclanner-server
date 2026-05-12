import { EXCLUDED_PATHS } from '@/config/route.config.js';
import type { Request, Response, NextFunction } from 'express';

export const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const isExcluded = EXCLUDED_PATHS.some((path) =>
    req.path.startsWith(path.replace('/api', '')),
  );

  if (isExcluded) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
  }

  next();
};
