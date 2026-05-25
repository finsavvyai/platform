// ClawProvider lives in ./provider-types.ts so this file stays under the
// 200-line cap. Imported + re-exported for backward compatibility.
import type { ClawProvider } from './provider-types.js'
export type { ClawProvider }

/** Role in a conversation message */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

/** Streaming event types from SSE */
export type StreamEventType =
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_stop'
  | 'error'
  | 'ping'

/** Permission level for tool execution */
export type PermissionMode =
  | 'read_only'
  | 'workspace_write'
  | 'full_access'

/** Session status in the gateway */
export type SessionStatus = 'active' | 'idle' | 'expired' | 'closed'

/** SDK configuration */
export interface ClawConfig {
  /** Unique project identifier (e.g., 'opensyber', 'mcpoverflow') */
  projectId: string
  /** API key for gateway authentication */
  apiKey: string
  /** Gateway endpoint URL */
  endpoint: string
  /** Default LLM provider */
  provider?: ClawProvider
  /** Default model name or alias */
  model?: string
  /** Maximum tokens per response */
  maxTokens?: number
  /** Request timeout in milliseconds */
  timeoutMs?: number
}

/** A single message in a conversation */
export interface ConversationMessage {
  role: MessageRole
  content: ContentBlock[]
}

/** Content block within a message */
export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

/** Tool definition for the LLM */
export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** Request to the Claw gateway */
export interface ClawRequest {
  /** User message or prompt */
  prompt: string
  /** System instruction override */
  system?: string
  /** Tools available for this request */
  tools?: ToolDefinition[]
  /** Provider override for this request */
  provider?: ClawProvider
  /** Model override for this request */
  model?: string
  /** Max tokens override */
  maxTokens?: number
}

/** Response from the Claw gateway */
export interface ClawResponse {
  /** Session ID for continuation */
  sessionId: string
  /** Response content as text */
  text: string
  /** Full content blocks */
  content: ContentBlock[]
  /** Token usage for this turn */
  usage: UsageSummary
  /** Whether the response was truncated */
  stopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'error'
}

/** Token usage tracking */
export interface UsageSummary {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** SSE stream event */
export interface StreamEvent {
  type: StreamEventType
  data: StreamEventData
}

export type StreamEventData =
  | MessageStartData
  | ContentBlockStartData
  | ContentBlockDeltaData
  | ContentBlockStopData
  | MessageStopData
  | ErrorData
  | PingData

export interface MessageStartData {
  type: 'message_start'
  sessionId: string
  model: string
}

export interface ContentBlockStartData {
  type: 'content_block_start'
  index: number
  contentBlock: { type: 'text' } | { type: 'tool_use'; id: string; name: string }
}

export interface ContentBlockDeltaData {
  type: 'content_block_delta'
  index: number
  delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string }
}

export interface ContentBlockStopData {
  type: 'content_block_stop'
  index: number
}

export interface MessageStopData {
  type: 'message_stop'
  usage: UsageSummary
  stopReason: string
}

export interface ErrorData {
  type: 'error'
  code: string
  message: string
}

export interface PingData {
  type: 'ping'
}

/** Session metadata returned by the gateway */
export interface SessionInfo {
  id: string
  projectId: string
  status: SessionStatus
  createdAt: string
  lastActiveAt: string
  messageCount: number
  totalTokens: number
}

/** Gateway error response */
export interface ClawError {
  code: string
  message: string
  details?: Record<string, unknown>
}
