/**
 * Agent Run Contract
 *
 * Typed envelope that defines an agent run BEFORE it executes. Carries the
 * five AI-SDLC concerns the agent must not be allowed to reason around:
 * trigger, scope, done-criteria, review policy, blast radius.
 *
 * Persisted in D1 (`agent_run_contracts` table) and referenced by every
 * agent run. The model receives a derived prompt — never the contract
 * itself — so it cannot rewrite its own boundaries.
 */

export type AgentTriggerSource =
  | 'ticket'
  | 'pull_request'
  | 'cve'
  | 'incident'
  | 'schedule'
  | 'webhook'
  | 'manual';

export type AgentReviewMode =
  | 'always'
  | 'on_diff_outside_scope'
  | 'on_failed_check'
  | 'never';

export type AgentBlastRadius =
  | 'read_only'
  | 'single_file'
  | 'single_pr'
  | 'multi_pr'
  | 'cross_repo';

/** Free-form key/value pulled from the triggering system (e.g. PipeWarden run_id). */
export interface AgentTriggerRef {
  source: AgentTriggerSource;
  external_id: string;
  url?: string;
}

/**
 * Machine-checkable acceptance criterion. Each item MUST be verifiable
 * without a human in the loop — that is the contract.
 */
export interface AgentDoneCriterion {
  /** Stable id within the contract — referenced by run reports. */
  id: string;
  kind: 'tests_pass' | 'lint_clean' | 'typecheck_clean' | 'file_exists' | 'regex_match' | 'custom';
  description: string;
  /** Provider-specific payload (e.g. `{ "command": "pnpm test --filter api" }`). */
  config: Readonly<Record<string, unknown>>;
}

/** Where the agent is allowed to read and write. */
export interface AgentScope {
  /** Org-qualified repo, e.g. `opensyber/opensyber`. */
  repo: string;
  /** Glob allowlist for writes; reads use `read_paths` (defaults to `**`). */
  write_paths: readonly string[];
  read_paths?: readonly string[];
  /** Egress domain allowlist. Empty array = no network. */
  egress_hosts: readonly string[];
  /** Named secret refs the run may resolve. Never the secret value. */
  secret_refs: readonly string[];
}

export interface AgentReviewPolicy {
  mode: AgentReviewMode;
  /** RBAC role(s) authorized to approve. */
  reviewer_roles: readonly string[];
  /** Hard ceiling on autonomous loop attempts before escalating to human. */
  max_autonomous_retries: number;
}

export interface AgentBudget {
  /** Wall-clock cap in seconds. */
  timeout_seconds: number;
  /** USD cap across all LLM calls + compute. */
  max_cost_usd: number;
  /** Cap on tool calls per run. Prevents runaway loops. */
  max_tool_calls: number;
}

/**
 * The full envelope. One contract → one run.
 * Never mutated after `created_at`; updates produce a new contract version.
 */
export interface AgentRunContract {
  contract_id: string;
  version: number;
  created_at: string;
  /** OpenSyber userId, or `'system'` for cron/webhook triggers. */
  requested_by: string;

  trigger: AgentTriggerRef;
  skill_id: string;
  scope: AgentScope;
  done_criteria: readonly AgentDoneCriterion[];
  review_policy: AgentReviewPolicy;
  blast_radius: AgentBlastRadius;
  budget: AgentBudget;

  /** Optional human-readable goal; informational only — `done_criteria` is the contract. */
  goal_summary?: string;
}

/** Fields a caller supplies; service fills the rest. */
export type AgentRunContractInput = Omit<
  AgentRunContract,
  'contract_id' | 'version' | 'created_at'
>;

/**
 * Type guard for safe parsing from JSON (D1 row, webhook body, etc).
 * Validates shape only — semantic checks (e.g. scope vs RBAC) live in service layer.
 */
export function isAgentRunContract(value: unknown): value is AgentRunContract {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.contract_id === 'string' &&
    typeof v.version === 'number' &&
    typeof v.created_at === 'string' &&
    typeof v.requested_by === 'string' &&
    typeof v.skill_id === 'string' &&
    typeof v.blast_radius === 'string' &&
    typeof v.trigger === 'object' &&
    typeof v.scope === 'object' &&
    Array.isArray(v.done_criteria) &&
    typeof v.review_policy === 'object' &&
    typeof v.budget === 'object'
  );
}

/** Default budget for "boring work" skills (CVE remediation, docs, deps). */
export const DEFAULT_BORING_WORK_BUDGET: AgentBudget = {
  timeout_seconds: 600,
  max_cost_usd: 2,
  max_tool_calls: 50,
};

/** Default review policy: never let an agent touch outside its declared scope without a human. */
export const STRICT_REVIEW_POLICY: AgentReviewPolicy = {
  mode: 'on_diff_outside_scope',
  reviewer_roles: ['maintainer', 'admin'],
  max_autonomous_retries: 2,
};
