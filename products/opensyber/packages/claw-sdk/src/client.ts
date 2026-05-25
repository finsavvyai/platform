import type {
  ClawConfig,
  ClawRequest,
  ClawResponse,
  SessionInfo,
  StreamEvent,
} from './types.js'
import { ClawSession } from './session.js'
import { parseSSEStream, collectStreamText } from './stream.js'
import { buildHeaders, buildUrl, handleErrorResponse } from './http.js'
import { resolveModel } from './providers.js'
import { LearningLayer } from './learning.js'

const DEFAULT_ENDPOINT = 'https://claw.opensyber.cloud'
const DEFAULT_MAX_TOKENS = 8192
const DEFAULT_TIMEOUT_MS = 120_000

/** Client for the Claw AI gateway — one-shot prompts, streaming, sessions */
export class ClawClient {
  private readonly config: Required<ClawConfig>
  private readonly learning: LearningLayer

  constructor(config: ClawConfig) {
    const resolved = config.model
      ? resolveModel(config.model, config.provider)
      : null

    this.config = {
      projectId: config.projectId,
      apiKey: config.apiKey,
      endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
      provider: resolved?.provider ?? config.provider ?? 'anthropic',
      model: resolved?.modelId ?? config.model ?? 'claude-sonnet-4-6',
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }
    this.learning = new LearningLayer()
  }

  /** Access the learning layer for diagnostics or manual control */
  getLearning(): LearningLayer {
    return this.learning
  }

  /** Send a one-shot prompt and get the full response */
  async prompt(prompt: string, options?: Partial<ClawRequest>): Promise<ClawResponse> {
    const { hash, provider, model } = this.resolveRoute(prompt, options)
    const start = Date.now()
    const url = buildUrl(this.config.endpoint, '/v1/prompt')
    const body = this.buildRequestBody(prompt, {
      ...options, provider: provider as ClawConfig['provider'], model,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })

    if (!response.ok) {
      this.recordLearning(hash, provider, model, false, Date.now() - start)
      throw await handleErrorResponse(response)
    }

    const result = (await response.json()) as ClawResponse
    this.recordLearning(hash, provider, model, true, Date.now() - start)
    this.learning.storeCache(hash, result.text)
    return result
  }

  /** Send a prompt and get a simple text response (cache-aware) */
  async ask(prompt: string, options?: Partial<ClawRequest>): Promise<string> {
    const hash = LearningLayer.hashPrompt(options?.system ?? '', prompt)
    const cached = this.learning.checkCache(hash)
    if (cached !== null) return cached
    const response = await this.prompt(prompt, options)
    return response.text
  }

  /** Stream response as SSE events */
  async *stream(prompt: string, options?: Partial<ClawRequest>): AsyncGenerator<StreamEvent> {
    const url = buildUrl(this.config.endpoint, '/v1/prompt')
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...buildHeaders(this.config), Accept: 'text/event-stream' },
      body: JSON.stringify({ ...this.buildRequestBody(prompt, options), stream: true }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })
    if (!response.ok) throw await handleErrorResponse(response)
    if (!response.body) throw new Error('No response body for streaming')
    yield* parseSSEStream(response.body)
  }

  /** Stream and collect the full text */
  async streamText(prompt: string, options?: Partial<ClawRequest>): Promise<string> {
    return collectStreamText(this.stream(prompt, options))
  }

  /** Create a new multi-turn conversation session */
  async createSession(options?: { system?: string }): Promise<ClawSession> {
    const url = buildUrl(this.config.endpoint, '/v1/sessions')
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(this.config),
      body: JSON.stringify({
        provider: this.config.provider, model: this.config.model, system: options?.system,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })
    if (!response.ok) throw await handleErrorResponse(response)
    const data = (await response.json()) as { sessionId: string }
    return new ClawSession(data.sessionId, this.config)
  }

  /** Resume an existing session by ID */
  resumeSession(sessionId: string): ClawSession {
    return new ClawSession(sessionId, this.config)
  }

  /** List active sessions for this project */
  async listSessions(): Promise<SessionInfo[]> {
    const url = buildUrl(this.config.endpoint, '/v1/sessions')
    const response = await fetch(url, {
      headers: buildHeaders(this.config),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    })
    if (!response.ok) throw await handleErrorResponse(response)
    const data = (await response.json()) as { sessions: SessionInfo[] }
    return data.sessions
  }

  /** Health check — verify gateway connectivity */
  async ping(): Promise<boolean> {
    try {
      const url = buildUrl(this.config.endpoint, '/health')
      const res = await fetch(url, {
        headers: { 'X-Project-Id': this.config.projectId },
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch { return false }
  }

  private resolveRoute(prompt: string, options?: Partial<ClawRequest>) {
    const system = options?.system ?? ''
    const hash = LearningLayer.hashPrompt(system, prompt)
    const provider = options?.provider ?? this.config.provider
    const model = options?.model ?? this.config.model
    const learned = this.learning.getBestRoute(hash)
    return { hash, provider: learned?.provider ?? provider, model: learned?.model ?? model }
  }

  private recordLearning(
    hash: string, provider: string, model: string, success: boolean, latencyMs: number
  ): void {
    this.learning.recordOutcome({ promptHash: hash, provider, model, success, latencyMs, timestamp: Date.now() })
  }

  private buildRequestBody(prompt: string, options?: Partial<ClawRequest>): Record<string, unknown> {
    return {
      prompt, system: options?.system, tools: options?.tools,
      provider: options?.provider ?? this.config.provider,
      model: options?.model ?? this.config.model,
      maxTokens: options?.maxTokens ?? this.config.maxTokens,
    }
  }
}
