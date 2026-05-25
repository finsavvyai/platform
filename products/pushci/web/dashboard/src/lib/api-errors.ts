export class ApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, message: string, body = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network request failed') {
    super(0, message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(message = 'Request timed out') {
    super(0, message);
    this.name = 'TimeoutError';
  }
}

export class AuthExpiredError extends ApiError {
  constructor() {
    super(401, 'Session expired');
    this.name = 'AuthExpiredError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to do that') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  readonly retryAfterSeconds: number | null;
  constructor(retryAfterSeconds: number | null = null, message = 'Too many requests') {
    super(429, message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ServerError extends ApiError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = 'ServerError';
  }
}

export const AUTH_EXPIRED_EVENT = 'pushci:auth-expired';
