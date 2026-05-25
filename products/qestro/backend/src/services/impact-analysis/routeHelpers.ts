/**
 * Impact Analysis Route Helpers
 */

import { Response } from 'express';

export function sendSuccess(res: Response, status: number, data: Record<string, unknown>) {
  res.status(status).json({ success: true, ...data });
}

export function sendError(res: Response, status: number, error: unknown, message?: string) {
  const msg = message || (error instanceof Error ? error.message : String(error));
  res.status(status).json({ error: msg });
}

export function validateParams(params: Record<string, unknown>, required: string[]): string | null {
  return required.find(field => !params[field]) ? `Missing: ${required.join(', ')}` : null;
}
