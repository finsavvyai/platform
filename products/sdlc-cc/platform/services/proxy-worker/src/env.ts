export interface Env {
  API_KEYS: KVNamespace;
  DB: D1Database;
  /** When set, proxy to this backend (e.g. SDLP Gateway) instead of OpenAI */
  BACKEND_URL?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  API_KEY_SECRET?: string;
  PII_DETECTION_ENABLED?: string;
  RATE_LIMIT_ENABLED?: string;
  /** When "false", monthly quota enforcement is skipped. */
  MONTHLY_QUOTA_ENABLED?: string;
  /** HMAC-SHA256 secret that gates POST /admin/plans. Empty disables the route. */
  ADMIN_HMAC_SECRET?: string;
  RUNNER_BASE_URL?: string;
  RUNNER_SHARED_SECRET?: string;
  RUNNER_TIMEOUT_MS?: string;
}
