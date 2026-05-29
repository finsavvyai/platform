import type { Request, Response, NextFunction } from 'express';
import type { APIErrorResponse } from '../types';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isDev = process.env.NODE_ENV !== 'production';

  if (err instanceof AppError) {
    const body: APIErrorResponse = {
      success: false,
      error: err.message,
      code: err.code,
      details: isDev ? err.details : undefined,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  console.error('[Unhandled Error]', err);

  const body: APIErrorResponse = {
    success: false,
    error: isDev ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
  };
  res.status(500).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: APIErrorResponse = {
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  };
  res.status(404).json(body);
}
