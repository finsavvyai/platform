/**
 * ClawPipe-backed llm-proxy — replaces the hand-rolled provider routing
 * in llm-proxy.ts with a single call to api.clawpipe.ai/v1/prompt.
 *
 * Why: ClawPipe gateway already handles 24+ providers, encrypted key
 * storage, retries, circuit breakers, cache, audit, and security
 * headers. Re-implementing here is duplicate work. Routing through it
 * also gives the rest of OpenSyber Booster + Packer + Cache for free.
 *
 * Migration: replace `from './llm-proxy'` with `from './llm-proxy-clawpipe'`.
 * Streaming still falls back to direct provider fetch (ClawPipe's
 * streaming surface is single-provider only).
 */
import type { Env, LLMRequest, LLMResponse, Provider } from '../types.js'

const CLAWPIPE_BASE = 'https://api.clawpipe.ai/v1'

interface ClawpipeEnv extends Env {
  CLAWPIPE_API_KEY?: string
  CLAWPIPE_PROJECT_ID?: string
}

export async function sendLLMRequest(env: ClawpipeEnv, request: LLMRequest): Promise<LLMResponse> {
  const apiKey = env.CLAWPIPE_API_KEY
  const projectId = env.CLAWPIPE_PROJECT_ID ?? 'opensyber-claw-gateway'
  if (!apiKey) {
    // Fallback to legacy direct call if ClawPipe not configured.
    const legacy = await import('./llm-proxy.js')
    return legacy.sendLLMRequest(env, request)
  }

  const userMessage = request.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n')
  const systemMessage = request.system ?? request.messages.find((m) => m.role === 'system')?.content

  const res = await fetch(`${CLAWPIPE_BASE}/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Project-Id': projectId,
    },
    body: JSON.stringify({
      prompt: userMessage,
      system: systemMessage,
      provider: request.provider,
      model: request.model,
      maxTokens: request.maxTokens,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[clawpipe ${request.provider}] ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = (await res.json()) as { text: string; tokensIn: number; tokensOut: number; latencyMs: number }
  return {
    text: data.text,
    content: [{ type: 'text', text: data.text }],
    usage: { inputTokens: data.tokensIn, outputTokens: data.tokensOut },
    stopReason: 'end_turn',
    model: request.model,
  } as LLMResponse
}

/** Streaming still goes direct — falls through to legacy proxy. */
export async function streamLLMRequest(env: ClawpipeEnv, request: LLMRequest): Promise<Response> {
  const legacy = await import('./llm-proxy.js')
  return legacy.streamLLMRequest(env, request)
}

export type { Provider }
