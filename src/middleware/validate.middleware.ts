// src/middleware/validate.ts
import type { Request, Response, NextFunction } from 'express';
import type { ZodError, ZodSchema } from 'zod';
import type { ParsedQs } from 'qs';

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
        req.query = schema.query.parse(req.query) as ParsedQs;
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params) as Record<string, string>;
      }

      next();
    } catch (error: any) {
      return res.status(400).json({
        error: 'Validation failed',
        details: JSON.parse((error as ZodError).message),
      });
    }
  };
