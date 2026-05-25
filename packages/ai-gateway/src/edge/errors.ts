/**
 * Edge-layer domain errors. Subclass `Error`, carry stable `code` per
 * swarm convention.
 */

export class EdgeAuthError extends Error {
  public readonly code = "AI_GATEWAY_EDGE_AUTH";
  public readonly status: 401 | 403;
  constructor(status: 401 | 403, reason: string) {
    super(`Edge auth rejected: ${reason}`);
    this.name = "EdgeAuthError";
    this.status = status;
  }
}

export class EdgeRateLimitedError extends Error {
  public readonly code = "AI_GATEWAY_EDGE_RATE_LIMITED";
  public readonly status = 429;
  public readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Edge rate limit exceeded.");
    this.name = "EdgeRateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class EdgeBadRequestError extends Error {
  public readonly code = "AI_GATEWAY_EDGE_BAD_REQUEST";
  public readonly status = 400;
  constructor(reason: string) {
    super(`Bad request: ${reason}`);
    this.name = "EdgeBadRequestError";
  }
}
