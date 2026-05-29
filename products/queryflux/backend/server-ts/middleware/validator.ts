import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from './errorHandler';

type RequestLocation = 'body' | 'params' | 'query';

export function validate(schema: z.ZodSchema, location: RequestLocation = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[location]);

    if (!result.success) {
      const errors = (result.error.issues as any[]).map((e) => ({
        path: (e.path ?? []).join('.'),
        message: e.message ?? 'Invalid',
      }));

      throw new AppError(400, 'Validation failed', 'VALIDATION_ERROR', errors);
    }

    req[location] = result.data;
    next();
  };
}
