/**
 * Zod Validation Middleware — wraps @hono/zod-validator with clean error formatting
 *
 * Usage in routes:
 *   import { validateJson } from '../middleware/validation';
 *   import { signupSchema } from '../schemas';
 *   route.post('/signup', validateJson(signupSchema), async (c) => { ... });
 */

import { zValidator } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';

/**
 * Validate JSON request body against a Zod schema.
 * Returns 400 with structured error details on failure.
 */
export function validateJson<T extends ZodSchema>(schema: T) {
    return zValidator('json', schema, (result, c) => {
        if (!result.success) {
            return c.json({
                error: 'Validation failed',
                details: result.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                    code: issue.code,
                })),
            }, 400);
        }
    });
}

/**
 * Validate query parameters against a Zod schema.
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
    return zValidator('query', schema, (result, c) => {
        if (!result.success) {
            return c.json({
                error: 'Invalid query parameters',
                details: result.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                    code: issue.code,
                })),
            }, 400);
        }
    });
}
