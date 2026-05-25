import type {
  ClawConfig,
  ClawRequest,
  ClawResponse,
  ConversationMessage,
  SessionInfo,
  StreamEvent,
  UsageSummary,
} from './types.js'
import { parseSSEStream } from './stream.js'
import { buildHeaders, buildUrl, handleErrorResponse } from './http.js'

/**
 * Manages a multi-turn conversation with the Claw gateway.
 * Each session maintains server-side state in a Durable Object.
 */
export class ClawSession {
  readonly id: string
  private readonly config: ClawConfig
  private totalUsage: UsageSummary = {
    inputTokens: 0,
    outputTokens: 0,
  }

  constructor(sessionId: string, config: ClawConfig) {
    this.id = sessionId
    this.config = config
  }

  /** Send a message and get a full response */
  async message(
    prompt: string,
    options?: Partial<ClawRequest>
  ): Promise<ClawResponse> {
    const url = buildUrl(
      this.config.endpoint,
      `/v1/sessions/${this.id}/message`
    )
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config),
      body: JSON.stringify({
        prompt,
        ...options,
        provider: options?.provider ?? this.config.provider,
        model: options?.model ?? this.config.model,
        maxTokens: options?.maxTokens ?? this.config.maxTokens,
      }),
      signal: this.buildAbortSignal(),
    })

    if (!response.ok) {
      throw await handleErrorResponse(response)
    }

    const result = (await response.json()) as ClawResponse
    this.accumulateUsage(result.usage)
    return result
  }

  /** Send a message and stream the response as SSE events */
  async *stream(
    prompt: string,
    options?: Partial<ClawRequest>
  ): AsyncGenerator<StreamEvent> {
    const url = buildUrl(
      this.config.endpoint,
      `/v1/sessions/${this.id}/message`
    )
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...buildHeaders(this.config),
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        prompt,
        stream: true,
        ...options,
        provider: options?.provider ?? this.config.provider,
        model: options?.model ?? this.config.model,
        maxTokens: options?.maxTokens ?? this.config.maxTokens,
      }),
      signal: this.buildAbortSignal(),
    })

    if (!response.ok) {
      throw await handleErrorResponse(response)
    }
    if (!response.body) {
      throw new Error('No response body for streaming')
    }

    for await (const event of parseSSEStream(response.body)) {
      if (event.data.type === 'message_stop' && 'usage' in event.data) {
        this.accumulateUsage(event.data.usage)
      }
      yield event
    }
  }

  /** Get conversation history from the gateway */
  async getHistory(): Promise<ConversationMessage[]> {
    const url = buildUrl(
      this.config.endpoint,
      `/v1/sessions/${this.id}`
    )
    const response = await fetch(url, {
      headers: buildHeaders(this.config),
      signal: this.buildAbortSignal(),
    })

    if (!response.ok) {
      throw await handleErrorResponse(response)
    }

    const data = (await response.json()) as { messages: ConversationMessage[] }
    return data.messages
  }

  /** Request the gateway to compact conversation history */
  async compact(): Promise<void> {
    const url = buildUrl(
      this.config.endpoint,
      `/v1/sessions/${this.id}/compact`
    )
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config),
      signal: this.buildAbortSignal(),
    })

    if (!response.ok) {
      throw await handleErrorResponse(response)
    }
  }

  /** Close the session and release server resources */
  async close(): Promise<void> {
    const url = buildUrl(
      this.config.endpoint,
      `/v1/sessions/${this.id}`
    )
    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(this.config),
      signal: this.buildAbortSignal(),
    })

    if (!response.ok) {
      throw await handleErrorResponse(response)
    }
  }

  /** Get session metadata */
  async getInfo(): Promise<SessionInfo> {
    const url = buildUrl(
      this.config.endpoint,
      `/v1/sessions/${this.id}/info`
    )
    const response = await fetch(url, {
      headers: buildHeaders(this.config),
      signal: this.buildAbortSignal(),
    })

    if (!response.ok) {
      throw await handleErrorResponse(response)
    }

    return (await response.json()) as SessionInfo
  }

  /** Accumulated token usage across all turns */
  getUsage(): UsageSummary {
    return { ...this.totalUsage }
  }

  private accumulateUsage(usage: UsageSummary): void {
    this.totalUsage.inputTokens += usage.inputTokens
    this.totalUsage.outputTokens += usage.outputTokens
    if (usage.cacheReadTokens) {
      this.totalUsage.cacheReadTokens =
        (this.totalUsage.cacheReadTokens ?? 0) + usage.cacheReadTokens
    }
    if (usage.cacheWriteTokens) {
      this.totalUsage.cacheWriteTokens =
        (this.totalUsage.cacheWriteTokens ?? 0) + usage.cacheWriteTokens
    }
  }

  private buildAbortSignal(): AbortSignal | undefined {
    if (!this.config.timeoutMs) return undefined
    return AbortSignal.timeout(this.config.timeoutMs)
  }
}
