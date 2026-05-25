/**
 * Domain errors for the AI gateway. Subclass `Error`, carry stable `code`.
 */

export class NoRouteError extends Error {
  public readonly code = "AI_GATEWAY_NO_ROUTE";
  constructor(reason: string) {
    super(`No provider route available: ${reason}`);
    this.name = "NoRouteError";
  }
}

export class NonRetryableProviderError extends Error {
  public readonly code = "AI_GATEWAY_NON_RETRYABLE";
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "NonRetryableProviderError";
    this.status = status;
  }
}

export class RetryableProviderError extends Error {
  public readonly code = "AI_GATEWAY_RETRYABLE";
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RetryableProviderError";
    this.status = status;
  }
}

export class GatewayExhaustedError extends Error {
  public readonly code = "AI_GATEWAY_EXHAUSTED";
  public readonly cause: unknown;
  constructor(cause: unknown) {
    super("Provider retry attempts exhausted.");
    this.name = "GatewayExhaustedError";
    this.cause = cause;
  }
}
