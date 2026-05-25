/**
 * Route Helpers - Common response handlers
 */

import { Response } from 'express';
import { logger } from '../../utils/logger.js';

export function successResponse(res: Response, statusCode: number, data: Record<string, unknown>) {
  res.status(statusCode).json({ success: true, ...data });
}

export function errorResponse(
  res: Response,
  statusCode: number,
  error: unknown,
  details?: string
) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`Error: ${message}`);
  res.status(statusCode).json({
    error: details || message,
    ...( error instanceof Error && { stack: error.stack }),
  });
}

export function validateRequest(body: Record<string, unknown>, required: string[]): string | null {
  for (const field of required) {
    if (!body[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

export function getStatusCode(message: string): number {
  if (message.includes('not found')) return 404;
  if (message.includes('full')) return 409;
  if (message.includes('required')) return 400;
  return 500;
}
