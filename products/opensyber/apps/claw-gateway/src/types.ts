/** Cloudflare Worker environment bindings */
export interface Env {
  PROJECT_KEYS: KVNamespace
  USAGE: KVNamespace
  CLAW_SESSION: DurableObjectNamespace
  ANTHROPIC_API_KEY: string
  OPENAI_API_KEY: string
  AI_GATEWAY_ENDPOINT?: string
  ENVIRONMENT: string
  DEFAULT_PROVIDER: string
  DEFAULT_MODEL: string
  DEFAULT_MAX_TOKENS: string
  OLLAMA_URL?: string
  /** Shared secret that gates the /admin/* surface. Unset = admin disabled. */
  CLAW_ADMIN_SECRET?: string
}

/** Supported LLM providers */
export type Provider = 'anthropic' | 'openai' | 'workers-ai'

/** Stored project configuration in KV */
export interface ProjectConfig {
  projectId: string
  name: string
  apiKeyHash: string
  defaultProvider: Provider
  defaultModel: string
  maxTokensPerRequest: number
  rateLimitPerMinute: number
  /** Optional daily request cap (defaults to 10_000 when unset or <=0) */
  rateLimitPerDay?: number
  /** Optional daily combined-token cap (defaults to 2_000_000 when unset or <=0) */
  tokensPerDay?: number
  enabled: boolean
}

/** LLM request routed to a provider */
export interface LLMRequest {
  provider: Provider
  model: string
  system?: string
  messages: LLMMessage[]
  maxTokens: number
  stream: boolean
  tools?: LLMToolDef[]
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | LLMContentBlock[]
}

export type LLMContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export interface LLMToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** LLM response from any provider */
export interface LLMResponse {
  text: string
  content: LLMContentBlock[]
  usage: { inputTokens: number; outputTokens: number }
  stopReason: string
  model: string
}

/** Session state stored in Durable Object SQL */
export interface StoredSession {
  id: string
  projectId: string
  provider: Provider
  model: string
  system: string | null
  status: 'active' | 'idle' | 'closed'
  createdAt: string
  lastActiveAt: string
  messageCount: number
  totalInputTokens: number
  totalOutputTokens: number
}

/** Session message stored in DO SQL */
export interface StoredMessage {
  id: number
  sessionId: string
  role: string
  content: string
  createdAt: string
}

/** Usage record stored in KV */
export interface UsageRecord {
  projectId: string
  date: string
  requestCount: number
  inputTokens: number
  outputTokens: number
}
