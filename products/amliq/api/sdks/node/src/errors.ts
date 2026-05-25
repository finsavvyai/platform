/** Base AMLIQ SDK error. */
export class AMLIQError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AMLIQError";
  }
}

/** Thrown when API key is invalid or missing. */
export class AuthError extends AMLIQError {
  constructor(message = "Invalid API key") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthError";
  }
}

/** Thrown when API rate limit is exceeded. */
export class RateLimitError extends AMLIQError {
  constructor(message = "Rate limit exceeded") {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}
