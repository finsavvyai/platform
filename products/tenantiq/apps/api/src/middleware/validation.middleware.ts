import type { Context, Next } from 'hono';
import type { z } from 'zod';

/**
 * Validation Middleware
 *
 * Validates request bodies, query parameters, and URL parameters using Zod schemas.
 * Provides type-safe validation with clear error messages.
 */

interface ValidationConfig {
	body?: z.ZodSchema;
	query?: z.ZodSchema;
	params?: z.ZodSchema;
}

/**
 * Helper function to validate only request body (shorthand for common use case)
 */
export function validateBody(schema: z.ZodSchema) {
	return validate({ body: schema });
}

/**
 * Creates a validation middleware with Zod schemas
 */
export function validate(config: ValidationConfig) {
	return async (c: Context, next: Next) => {
		try {
			// Validate request body
			if (config.body) {
				const body = await c.req.json();
				const result = config.body.safeParse(body);

				if (!result.success) {
					return c.json(
						{
							error: 'Validation Error',
							message: 'Invalid request body',
							details: result.error.errors.map((err) => ({
								path: err.path.join('.'),
								message: err.message,
							})),
						},
						400
					);
				}

				// Store validated data for downstream handlers
				c.set('validatedBody', result.data);
			}

			// Validate query parameters
			if (config.query) {
				const query = c.req.query();
				const result = config.query.safeParse(query);

				if (!result.success) {
					return c.json(
						{
							error: 'Validation Error',
							message: 'Invalid query parameters',
							details: result.error.errors.map((err) => ({
								path: err.path.join('.'),
								message: err.message,
							})),
						},
						400
					);
				}

				c.set('validatedQuery', result.data);
			}

			// Validate URL parameters
			if (config.params) {
				const params = c.req.param();
				const result = config.params.safeParse(params);

				if (!result.success) {
					return c.json(
						{
							error: 'Validation Error',
							message: 'Invalid URL parameters',
							details: result.error.errors.map((err) => ({
								path: err.path.join('.'),
								message: err.message,
							})),
						},
						400
					);
				}

				c.set('validatedParams', result.data);
			}

			await next();
		} catch (error) {
			console.error('Validation error:', error);
			return c.json(
				{
					error: 'Validation Error',
					message: error instanceof Error ? error.message : 'Failed to validate request',
				},
				400
			);
		}
	};
}
