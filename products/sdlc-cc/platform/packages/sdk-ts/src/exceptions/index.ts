// Exception classes for the SDLC.ai JavaScript SDK

export class SDLCException extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: unknown;
  public readonly requestId?: string;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string = "UNKNOWN_ERROR",
    statusCode?: number,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "SDLCException";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SDLCException);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      requestId: this.requestId,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Authentication Errors
export class AuthenticationError extends SDLCException {
  constructor(message: string = "Authentication failed", details?: unknown) {
    super(message, "AUTHENTICATION_ERROR", 401, details);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends SDLCException {
  constructor(message: string = "Access denied", details?: unknown) {
    super(message, "AUTHORIZATION_ERROR", 403, details);
    this.name = "AuthorizationError";
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(message: string = "Token has expired") {
    super(message, { expired: true });
    this.name = "TokenExpiredError";
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message: string = "Invalid token provided") {
    super(message, { invalid: true });
    this.name = "InvalidTokenError";
  }
}

export class MFACodeError extends AuthenticationError {
  constructor(message: string = "Invalid or missing MFA code") {
    super(message, { mfaRequired: true });
    this.name = "MFACodeError";
  }
}

// Network Errors
export class NetworkError extends SDLCException {
  constructor(message: string = "Network error occurred", details?: unknown) {
    super(message, "NETWORK_ERROR", undefined, details);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends NetworkError {
  constructor(message: string = "Request timed out", timeout?: number) {
    super(message, { timeout });
    this.name = "TimeoutError";
  }
}

export class ConnectionError extends NetworkError {
  constructor(message: string = "Connection failed", details?: unknown) {
    super(message, details);
    this.name = "ConnectionError";
  }
}

export class RateLimitError extends SDLCException {
  public readonly retryAfter: number | undefined;
  public readonly limit: number | undefined;
  public readonly remaining: number | undefined;
  public readonly reset: number | undefined;

  constructor(
    message: string = "Rate limit exceeded",
    headers?: {
      "retry-after"?: string;
      "x-ratelimit-limit"?: string;
      "x-ratelimit-remaining"?: string;
      "x-ratelimit-reset"?: string;
    },
  ) {
    const retryAfter = headers?.["retry-after"]
      ? parseInt(headers["retry-after"])
      : undefined;
    const limit = headers?.["x-ratelimit-limit"]
      ? parseInt(headers["x-ratelimit-limit"])
      : undefined;
    const remaining = headers?.["x-ratelimit-remaining"]
      ? parseInt(headers["x-ratelimit-remaining"])
      : undefined;
    const reset = headers?.["x-ratelimit-reset"]
      ? parseInt(headers["x-ratelimit-reset"])
      : undefined;

    super(message, "RATE_LIMIT_ERROR", 429, {
      retryAfter,
      limit,
      remaining,
      reset,
    });
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = remaining;
    this.reset = reset;
  }
}

// API Errors
export class APIError extends SDLCException {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: unknown,
    requestId?: string,
  ) {
    super(message, code, statusCode, details, requestId);
    this.name = "APIError";
  }
}

export class BadRequestError extends APIError {
  constructor(
    message: string = "Bad request",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, "BAD_REQUEST", 400, details, requestId);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends APIError {
  constructor(
    message: string = "Resource not found",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, "NOT_FOUND", 404, details, requestId);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends APIError {
  constructor(
    message: string = "Resource conflict",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, "CONFLICT", 409, details, requestId);
    this.name = "ConflictError";
  }
}

export class UnprocessableEntityError extends APIError {
  constructor(
    message: string = "Unprocessable entity",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, "UNPROCESSABLE_ENTITY", 422, details, requestId);
    this.name = "UnprocessableEntityError";
  }
}

export class InternalServerError extends APIError {
  constructor(
    message: string = "Internal server error",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, "INTERNAL_SERVER_ERROR", 500, details, requestId);
    this.name = "InternalServerError";
  }
}

export class ServiceUnavailableError extends APIError {
  constructor(
    message: string = "Service unavailable",
    details?: unknown,
    requestId?: string,
  ) {
    super(message, "SERVICE_UNAVAILABLE", 503, details, requestId);
    this.name = "ServiceUnavailableError";
  }
}

// Validation Errors
export class ValidationError extends SDLCException {
  public readonly field: string | undefined;
  public readonly value?: unknown;

  constructor(
    message: string = "Validation failed",
    field?: string,
    value?: unknown,
    details?: unknown,
  ) {
    super(message, "VALIDATION_ERROR", 400, {
      field,
      value,
      ...(typeof details === 'object' && details !== null ? details : {}),
    });
    this.name = "ValidationError";
    this.field = field;
    this.value = value;
  }
}

export class RequiredFieldError extends ValidationError {
  constructor(field: string, value?: unknown) {
    super(`Field '${field}' is required`, field, value);
    this.name = "RequiredFieldError";
  }
}

export class InvalidFormatError extends ValidationError {
  constructor(field: string, format: string, value?: unknown) {
    super(`Field '${field}' must be in ${format} format`, field, value, {
      format,
    });
    this.name = "InvalidFormatError";
  }
}

export class InvalidRangeError extends ValidationError {
  constructor(field: string, min?: number, max?: number, value?: unknown) {
    let message = `Field '${field}'`;
    if (min !== undefined && max !== undefined) {
      message += ` must be between ${min} and ${max}`;
    } else if (min !== undefined) {
      message += ` must be at least ${min}`;
    } else if (max !== undefined) {
      message += ` must be at most ${max}`;
    }
    message += ` (got ${value})`;

    super(message, field, value, { min, max });
    this.name = "InvalidRangeError";
  }
}

// Configuration Errors
export class ConfigurationError extends SDLCException {
  constructor(message: string = "Configuration error", details?: unknown) {
    super(message, "CONFIGURATION_ERROR", undefined, details);
    this.name = "ConfigurationError";
  }
}

export class MissingConfigError extends ConfigurationError {
  constructor(field: string) {
    super(`Missing required configuration: ${field}`, { field });
    this.name = "MissingConfigError";
  }
}

export class InvalidConfigError extends ConfigurationError {
  constructor(field: string, value: unknown, reason?: string) {
    super(
      `Invalid configuration for ${field}: ${reason || "invalid value"}`,
      {
        field,
        value,
        reason,
      },
    );
    this.name = "InvalidConfigError";
  }
}

// Business Logic Errors
export class BusinessLogicError extends SDLCException {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, 422, details);
    this.name = "BusinessLogicError";
  }
}

export class QuotaExceededError extends BusinessLogicError {
  constructor(resource: string, limit: number, current: number) {
    super(
      `Quota exceeded for ${resource}. Limit: ${limit}, Current: ${current}`,
      "QUOTA_EXCEEDED",
      { resource, limit, current },
    );
    this.name = "QuotaExceededError";
  }
}

export class SubscriptionRequiredError extends BusinessLogicError {
  constructor(feature: string) {
    super(
      `Subscription required for feature: ${feature}`,
      "SUBSCRIPTION_REQUIRED",
      { feature },
    );
    this.name = "SubscriptionRequiredError";
  }
}

export class TenantInactiveError extends BusinessLogicError {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} is inactive`, "TENANT_INACTIVE", { tenantId });
    this.name = "TenantInactiveError";
  }
}

export class DocumentProcessingError extends BusinessLogicError {
  constructor(documentId: string, stage: string, error: string) {
    super(
      `Document processing failed for ${documentId} at stage: ${stage}`,
      "DOCUMENT_PROCESSING_ERROR",
      { documentId, stage, error },
    );
    this.name = "DocumentProcessingError";
  }
}

export class EmbeddingGenerationError extends BusinessLogicError {
  constructor(reason: string, details?: unknown) {
    super(
      `Failed to generate embeddings: ${reason}`,
      "EMBEDDING_GENERATION_ERROR",
      details,
    );
    this.name = "EmbeddingGenerationError";
  }
}

export class PolicyEvaluationError extends BusinessLogicError {
  constructor(policyId: string, reason: string) {
    super(
      `Policy evaluation failed for ${policyId}: ${reason}`,
      "POLICY_EVALUATION_ERROR",
      { policyId, reason },
    );
    this.name = "PolicyEvaluationError";
  }
}

// WebSocket Errors
export class WebSocketError extends SDLCException {
  constructor(message: string, details?: unknown) {
    super(message, "WEBSOCKET_ERROR", undefined, details);
    this.name = "WebSocketError";
  }
}

export class WebSocketConnectionError extends WebSocketError {
  constructor(url: string, reason?: string) {
    super(`Failed to connect to WebSocket: ${url}`, { url, reason });
    this.name = "WebSocketConnectionError";
  }
}

export class WebSocketClosedError extends WebSocketError {
  constructor(code?: number, reason?: string) {
    super("WebSocket connection closed", { code, reason });
    this.name = "WebSocketClosedError";
  }
}

// Utility function to create appropriate error from API response
export function createErrorFromResponse(
  error: Record<string, unknown>,
  statusCode?: number,
  requestId?: string,
): SDLCException {
  const message =
    typeof error.message === "string" ? error.message : "An error occurred";
  const code = typeof error.code === "string" ? error.code : "API_ERROR";
  const details = error.details ?? error;
  const headers =
    typeof error.headers === "object" && error.headers !== null
      ? (error.headers as Record<string, string>)
      : undefined;

  switch (statusCode) {
    case 400:
      return new BadRequestError(message, details, requestId);
    case 401:
      if (error.expired) {
        return new TokenExpiredError(message);
      }
      if (error.invalid) {
        return new InvalidTokenError(message);
      }
      if (error.mfaRequired) {
        return new MFACodeError(message);
      }
      return new AuthenticationError(message, details);
    case 403:
      return new AuthorizationError(message, details);
    case 404:
      return new NotFoundError(message, details, requestId);
    case 409:
      return new ConflictError(message, details, requestId);
    case 422:
      return new UnprocessableEntityError(message, details, requestId);
    case 429:
      return new RateLimitError(message, headers);
    case 500:
      return new InternalServerError(message, details, requestId);
    case 503:
      return new ServiceUnavailableError(message, details, requestId);
    default:
      return new APIError(message, code, statusCode, details, requestId);
  }
}
