/**
 * Structured application errors with machine-readable codes.
 * All API error responses use this format for consistency.
 */

export type ErrorCode =
	| 'AUTH_REQUIRED'
	| 'AUTH_EXPIRED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'VALIDATION_ERROR'
	| 'RATE_LIMITED'
	| 'BILLING_REQUIRED'
	| 'INTERNAL_ERROR';

const STATUS_MAP: Record<ErrorCode, number> = {
	AUTH_REQUIRED: 401,
	AUTH_EXPIRED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	VALIDATION_ERROR: 422,
	RATE_LIMITED: 429,
	BILLING_REQUIRED: 402,
	INTERNAL_ERROR: 500,
};

export class AppError extends Error {
	public readonly code: ErrorCode;
	public readonly status: number;
	public readonly details?: Record<string, unknown>;

	constructor(
		code: ErrorCode,
		message: string,
		details?: Record<string, unknown>
	) {
		super(message);
		this.name = 'AppError';
		this.code = code;
		this.status = STATUS_MAP[code];
		this.details = details;
	}

	/** Serialize to a consistent JSON response body. */
	toJSON() {
		return {
			error: {
				code: this.code,
				message: this.message,
				...(this.details ? { details: this.details } : {}),
			},
		};
	}
}

// ── Factory helpers ──────────────────────────────────────────────

export function authRequired(message = 'Authentication required') {
	return new AppError('AUTH_REQUIRED', message);
}

export function authExpired(message = 'Token has expired') {
	return new AppError('AUTH_EXPIRED', message);
}

export function forbidden(message = 'Access denied') {
	return new AppError('FORBIDDEN', message);
}

export function notFound(resource = 'Resource') {
	return new AppError('NOT_FOUND', `${resource} not found`);
}

export function validationError(
	message: string,
	details?: Record<string, unknown>
) {
	return new AppError('VALIDATION_ERROR', message, details);
}

export function rateLimited(retryAfter: number) {
	return new AppError('RATE_LIMITED', 'Rate limit exceeded', {
		retryAfter,
	});
}

export function billingRequired(message = 'Upgrade required') {
	return new AppError('BILLING_REQUIRED', message);
}

export function internalError(message = 'Internal server error') {
	return new AppError('INTERNAL_ERROR', message);
}
