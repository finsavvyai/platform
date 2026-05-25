export const AGENT_RUN_TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;

export type AgentRunTerminalStatus = (typeof AGENT_RUN_TERMINAL_STATUSES)[number];
export type AgentRunStatus =
  | 'accepted'
  | 'dispatched'
  | 'running'
  | AgentRunTerminalStatus
  | 'cancelling';

export interface AgentRunRequest {
  project_id: string;
  session_id: string;
  tenant_id: string;
  user_id?: string;
  adapter: string;
  goal: string;
  model: string;
  max_steps?: number;
  stream?: boolean;
  metadata?: Record<string, string>;
}

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface AgentRunRecord {
  run_id: string;
  project_id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  api_key_id: string;
  adapter: string;
  model: string;
  status: AgentRunStatus;
  goal: string;
  summary: string | null;
  result_json: string | null;
  error_json: string | null;
  usage_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunResponse {
  run_id: string;
  status: AgentRunStatus;
  project_id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  adapter: string;
  model: string;
  summary: string | null;
  result: unknown;
  error: unknown;
  usage: TokenUsage | null;
  created_at: string;
  updated_at: string;
}

export interface RunnerDispatchPayload {
  run_id: string;
  project_id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  adapter: string;
  goal: string;
  model: string;
  max_steps: number;
  stream: boolean;
  tool_base_url: string;
  callback_url: string;
  metadata: Record<string, string>;
}

export interface RunnerCallbackPayload {
  status: AgentRunStatus;
  summary?: string;
  result?: unknown;
  usage?: TokenUsage;
  error?: unknown;
}

export interface RunnerDispatchTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  project_id: string;
  tenant_id: string;
  user_id: string;
  adapter: string;
  model: string;
}
