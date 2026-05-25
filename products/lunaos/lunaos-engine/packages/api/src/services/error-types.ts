/**
 * Application Error Types — structured error classes for the API
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type SeverityLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface ErrorContext {
    userId?: string;
    requestId?: string;
    path?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface LogEntry {
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message: string;
    timestamp: string;
    requestId?: string;
    userId?: string;
    error?: { name: string; message: string; stack?: string };
    metadata?: Record<string, unknown>;
}

// ─── Error Classes ──────────────────────────────────────────────────────────

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: string;
    public readonly isOperational: boolean;
    public readonly context?: ErrorContext;

    constructor(
        message: string,
        statusCode: number = 500,
        errorCode: string = 'INTERNAL_ERROR',
        isOperational: boolean = true,
        context?: ErrorContext,
    ) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        this.context = context;
    }
}

export class ValidationError extends AppError {
    public readonly fields: Record<string, string>;

    constructor(message: string, fields: Record<string, string> = {}) {
        super(message, 400, 'VALIDATION_ERROR', true);
        this.name = 'ValidationError';
        this.fields = fields;
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR', true);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Permission denied') {
        super(message, 403, 'AUTHORIZATION_ERROR', true);
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND', true);
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT', true);
        this.name = 'ConflictError';
    }
}

export class RateLimitError extends AppError {
    constructor(retryAfter: number = 60) {
        super(`Rate limit exceeded. Try again in ${retryAfter} seconds`, 429, 'RATE_LIMITED', true);
        this.name = 'RateLimitError';
    }
}
