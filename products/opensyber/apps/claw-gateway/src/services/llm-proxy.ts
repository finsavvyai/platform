import type { Env, LLMRequest, LLMResponse, Provider } from '../types.js'

const PROVIDER_URLS: Record<Provider, string> = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  'workers-ai': '', // Set dynamically from env
}

/** Send a non-streaming LLM request and return parsed response */
export async function sendLLMRequest(
  env: Env,
  request: LLMRequest
): Promise<LLMResponse> {
  const { provider } = request
  const url = getProviderUrl(env, provider)
  const headers = getProviderHeaders(env, provider)
  const body = formatRequestBody(request)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`[${provider}] ${response.status}: ${error}`)
  }

  const data = (await response.json()) as Record<string, unknown>
  return parseProviderResponse(provider, data)
}

/** Send a streaming LLM request and return the raw Response for SSE passthrough */
export async function streamLLMRequest(
  env: Env,
  request: LLMRequest
): Promise<Response> {
  const { provider } = request
  const url = getProviderUrl(env, provider)
  const headers = getProviderHeaders(env, provider)
  const body = formatRequestBody({ ...request, stream: true })

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`[${provider}] ${response.status}: ${error}`)
  }

  return response
}

function getProviderUrl(env: Env, provider: Provider): string {
  if (env.AI_GATEWAY_ENDPOINT) {
    return `${env.AI_GATEWAY_ENDPOINT}/${provider}`
  }
  return PROVIDER_URLS[provider]
}

function getProviderHeaders(
  env: Env,
  provider: Provider
): Record<string, string> {
  switch (provider) {
    case 'anthropic':
      return {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      }
    case 'openai':
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      }
    case 'workers-ai':
      return { 'Content-Type': 'application/json' }
  }
}

function formatRequestBody(
  request: LLMRequest
): Record<string, unknown> {
  switch (request.provider) {
    case 'anthropic':
      return {
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: request.messages,
        stream: request.stream,
        ...(request.tools?.length ? { tools: request.tools } : {}),
      }
    case 'openai':
      return formatOpenAIBody(request)
    case 'workers-ai':
      return {
        model: request.model,
        max_tokens: request.maxTokens,
        messages: [
          ...(request.system ? [{ role: 'system', content: request.system }] : []),
          ...request.messages,
        ],
        stream: request.stream,
      }
  }
}

function formatOpenAIBody(
  request: LLMRequest
): Record<string, unknown> {
  const messages = [
    ...(request.system ? [{ role: 'system', content: request.system }] : []),
    ...request.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  ]
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    messages,
    stream: request.stream,
    ...(request.tools?.length
      ? {
          tools: request.tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.input_schema },
          })),
        }
      : {}),
  }
}

function parseProviderResponse(
  provider: Provider,
  data: Record<string, unknown>
): LLMResponse {
  switch (provider) {
    case 'anthropic':
      return parseAnthropicResponse(data)
    case 'openai':
      return parseOpenAIResponse(data)
    case 'workers-ai':
      return parseWorkersAIResponse(data)
  }
}

function parseAnthropicResponse(data: Record<string, unknown>): LLMResponse {
  const content = data.content as Array<{ type: string; text?: string }>
  const usage = data.usage as { input_tokens: number; output_tokens: number }
  return {
    text: content.filter((c) => c.type === 'text').map((c) => c.text).join(''),
    content: content as LLMResponse['content'],
    usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
    stopReason: data.stop_reason as string,
    model: data.model as string,
  }
}

function parseOpenAIResponse(data: Record<string, unknown>): LLMResponse {
  const choices = data.choices as Array<{ message: { content: string }; finish_reason: string }>
  const usage = data.usage as { prompt_tokens: number; completion_tokens: number }
  const text = choices[0]?.message?.content ?? ''
  return {
    text,
    content: [{ type: 'text', text }],
    usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens },
    stopReason: choices[0]?.finish_reason ?? 'stop',
    model: data.model as string,
  }
}

function parseWorkersAIResponse(data: Record<string, unknown>): LLMResponse {
  const result = (data.result ?? data) as { response?: string }
  const text = result.response ?? ''
  return {
    text,
    content: [{ type: 'text', text }],
    usage: { inputTokens: 0, outputTokens: 0 },
    stopReason: 'end_turn',
    model: 'workers-ai',
  }
}
