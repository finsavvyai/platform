/**
 * API response types matching lunaos-engine contracts.
 * Kept in sync with packages/api/src/routes/*.ts
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tier: 'free' | 'pro' | 'team';
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface AuthErrorResponse {
  error: string;
}

export interface AgentListItem {
  slug: string;
  name: string;
  category: string;
  tier: 'free' | 'pro';
  hasSystemPrompt: boolean;
}

export interface AgentListResponse {
  agents: AgentListItem[];
  total: number;
  free: number;
  pro: number;
}

export interface ExecuteParams {
  agent: string;
  context: string;
  provider?: 'anthropic' | 'openai' | 'deepseek';
  model?: string;
  useRag?: boolean;
}

export interface SSETokenEvent {
  event: 'token';
  data: string;
}

export interface SSEDoneEvent {
  event: 'done';
  data: {
    executionId: string;
    duration: number;
    tokens: TokenUsage;
  };
}

export interface SSERagEvent {
  event: 'rag';
  data: {
    sources: number;
    searchTimeMs: number;
  };
}

export interface SSEErrorEvent {
  event: 'error';
  data: { error: string };
}

export type SSEEvent =
  | SSETokenEvent
  | SSEDoneEvent
  | SSERagEvent
  | SSEErrorEvent;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface Execution {
  id: string;
  agent: string;
  provider: string;
  model: string;
  duration_ms: number;
  output_length: number;
  created_at: string;
}

export interface ExecutionsResponse {
  executions: Execution[];
  count: number;
}
