/**
 * `ConnectorError` extension carrying a `meta.retry_after_seconds`
 * payload. The shared `ConnectorError` in `types.ts` has no `meta` field;
 * subclassing here keeps the cross-package contract surface untouched
 * (round-2 rule) while satisfying the Brain Month 3 mesh §8 spec.
 */
import { ConnectorError, type ConnectorSource } from "../types.js";

const JIRA: ConnectorSource = "jira" as unknown as ConnectorSource;

export class JiraRateLimitedError extends ConnectorError {
  public readonly meta: { readonly retry_after_seconds?: number };
  constructor(message: string, retryAfterSeconds?: number) {
    super(JIRA, "rate_limited", message, 429);
    this.name = "JiraRateLimitedError";
    this.meta = retryAfterSeconds !== undefined
      ? { retry_after_seconds: retryAfterSeconds }
      : {};
  }
}
