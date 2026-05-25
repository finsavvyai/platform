/**
 * Error Handler — middleware helper for structured error responses
 */

import { AppError, ValidationError, type ErrorContext } from './error-types';
import { errorTracker } from './error-tracking';

/**
 * Create a reusable error handler for request processing.
 */
export function createErrorHandler() {
    return async (
        error: Error,
        request: { path: string; method: string; headers: Record<string, string> },
        env: { USER_ID?: string; REQUEST_ID?: string },
    ) => {
        const context: ErrorContext = {
            userId: env.USER_ID,
            requestId: env.REQUEST_ID,
            path: request.path,
            method: request.method,
            userAgent: request.headers['user-agent'],
        };

        // Handle known application errors
        if (error instanceof AppError) {
            errorTracker.log(error.isOperational ? 'warn' : 'error', error.message, {
                requestId: context.requestId,
                userId: context.userId,
                error: { name: error.name, message: error.message, stack: error.stack },
                metadata: { statusCode: error.statusCode, errorCode: error.errorCode },
            });

            return {
                success: false,
                error: error.message,
                error_code: error.errorCode,
                ...(error instanceof ValidationError && { fields: error.fields }),
            };
        }

        // Handle unknown errors
        errorTracker.captureException(error, context);

        return {
            success: false,
            error: 'An unexpected error occurred',
            error_code: 'INTERNAL_ERROR',
        };
    };
}
