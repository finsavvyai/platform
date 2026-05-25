export type RunStatus = "pending" | "running" | "passed" | "failed" | "cancelled";
export type Platform = "github" | "gitlab" | "bitbucket";
export type EventType = "push" | "pull_request";
export type RunnerStatus = "idle" | "busy" | "offline";
export type JobKind = "ci" | "deploy";
export type JobStatus = "queued" | "running" | "passed" | "failed" | "cancelled";
export type ProjectRole =
  | "admin"
  | "maintainer"
  | "release_manager"
  | "deploy_approver"
  | "developer"
  | "viewer"
  | "auditor";
export type DeploymentRequestStatus =
  | "blocked"
  | "awaiting_approval"
  | "approved"
  | "queued"
  | "executed"
  | "failed";

export interface Run {
  id: string;
  repo: string;
  branch: string;
  sha: string;
  status: RunStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  checks_json: string | null;
}

export interface Project {
  id: string;
  repo: string;
  platform: Platform;
  created_at: string;
  webhook_secret: string;
}

export interface ProjectMembership {
  project_id: string;
  user_sub: string;
  login: string;
  provider: "github" | "gitlab" | "google" | "linkedin" | "facebook" | "bitbucket" | "microsoft";
  role: ProjectRole;
  environments: string[];
  created_at: string;
  updated_at: string;
}

export interface DeploymentPolicy {
  project_id: string;
  environment: string;
  required_review_approvals: number;
  required_manual_approvals: number;
  require_protected_branch: boolean;
  require_separation_of_duties: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeploymentRequest {
  id: string;
  project_id: string;
  environment: string;
  branch: string;
  sha: string | null;
  run_id: string | null;
  requested_by_sub: string;
  requested_by_login: string;
  executed_by_sub: string | null;
  executed_by_login: string | null;
  status: DeploymentRequestStatus;
  review_count: number;
  protected_branch: boolean;
  actor_is_author: boolean;
  tests_passed: boolean;
  secret_leak: boolean;
  has_sbom: boolean;
  policy_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunnerRecord {
  id: string;
  project_id: string;
  name: string;
  token_hash: string;
  labels_json: string;
  os: string;
  arch: string;
  status: RunnerStatus;
  ip: string | null;
  version: string | null;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
}

export interface RunnerRegistrationToken {
  id: string;
  project_id: string;
  token_hash: string;
  created_by_sub: string;
  created_by_login: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface JobRecord {
  id: string;
  run_id: string | null;
  project_id: string;
  runner_id: string | null;
  kind: JobKind;
  repo: string;
  branch: string;
  sha: string;
  environment: string | null;
  status: JobStatus;
  steps_json: string;
  labels_json: string;
  payload_json: string;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface WebhookEvent {
  platform: Platform;
  event_type: EventType;
  repo: string;
  branch: string;
  sha: string;
  sender: string;
}

export interface Env {
  DB: D1Database;
  RUNNERS: KVNamespace;
  /**
   * Rate-limit Durable Object namespace (I-002 fix). Strongly
   * consistent per-IP counter used by `rateLimitMiddlewareDO`.
   * Declared in wrangler.toml. Optional: when unbound (e.g. legacy
   * test envs), middleware falls back to the KV-backed path.
   */
  RATE_LIMITER?: DurableObjectNamespace;
  APP_URL: string;
  ANTHROPIC_API_KEY: string;
  AGENT_CORE_URL?: string;
  AGENT_CORE_TOKEN?: string;
  PUSHCI_SERVICE_TOKEN?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITLAB_CLIENT_ID: string;
  GITLAB_CLIENT_SECRET: string;
  GITLAB_BASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  LINKEDIN_CLIENT_ID: string;
  LINKEDIN_CLIENT_SECRET: string;
  FACEBOOK_CLIENT_ID: string;
  FACEBOOK_CLIENT_SECRET: string;
  BITBUCKET_CLIENT_ID: string;
  BITBUCKET_CLIENT_SECRET: string;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_TENANT_ID: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  LEMONSQUEEZY_STORE_ID: string;
  PUSHCI_LS_VARIANT_PRO: string;
  PUSHCI_LS_VARIANT_TEAM: string;
  RESEND_API_KEY?: string;
  OPENSYBER_GATEWAY_TOKEN?: string;
  LUNAOS_API_TOKEN?: string;
  E2E_TEST_SECRET?: string;
  AWS_STS_ACCESS_KEY_ID?: string;
  AWS_STS_SECRET_ACCESS_KEY?: string;
  /**
   * 32-byte AES-GCM master key (base64url) used to envelope-encrypt
   * per-user AWS credentials before they land in KV. Set via:
   *   wrangler secret put PUSHCI_CRED_ENCRYPTION_KEY
   * If unset, credential writes refuse to proceed.
   */
  PUSHCI_CRED_ENCRYPTION_KEY?: string;
  /**
   * Opt-in flag enabling long-lived AWS access-key storage. Default
   * denies static creds and forces customers onto role-mode
   * (AssumeRole + externalId). Accepts "1", "true", "yes".
   */
  PUSHCI_ALLOW_STATIC_CREDS?: string;
  /**
   * Shared Bearer secret that PushCI pipeline runners send on
   * POST /api/integrations/cepien/callback. Set via:
   *   wrangler secret put PUSHCI_RUNNER_CALLBACK_SECRET
   * Rotated per-deploy. The runner authenticates with this exact
   * value; handler rejects any other token with 401.
   */
  PUSHCI_RUNNER_CALLBACK_SECRET?: string;
  /**
   * Feature flag — Cepien integration (v1.6.6 audit I-001). Cepien
   * hasn't published their production webhook schema yet; mounting
   * the routes unconditionally risks silent 401s when the real API
   * launches with a schema drift. Default OFF — routes return 404.
   * Set to "1" or "true" in wrangler.toml / `wrangler secret put`
   * to enable in environments where you trust the current schema.
   */
  ENABLE_CEPIEN?: string;
}

export interface JwtPayload {
  sub: string;
  login: string;
  provider: "github" | "gitlab" | "google" | "linkedin" | "facebook" | "bitbucket" | "microsoft";
  iat: number;
  exp: number;
}
