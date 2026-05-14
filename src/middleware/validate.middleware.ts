// src/middleware/validate.ts
import type { Request, Response, NextFunction } from 'express';
import type { ZodError, ZodSchema } from 'zod';

type Schema = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
};

export const validate =
  (schema: Schema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      if (schema.query) {
        const parsedQuery = schema.query.parse(req.query);
        Object.assign(req.query, parsedQuery);
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params) as Record<string, string>;
      }

      next();
    } catch (error: any) {
      let details;
      try {
        details = JSON.parse((error as ZodError).message);
      } catch {
        details = (error as ZodError).message;
      }
      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }
  };
