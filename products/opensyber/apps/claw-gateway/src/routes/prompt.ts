import { Hono } from 'hono'
import { z } from 'zod'
import type { Env, Provider } from '../types.js'
import { sendLLMRequest, streamLLMRequest } from '../services/llm-proxy.js'

type Variables = { projectId: string }

const promptSchema = z.object({
  prompt: z.string().min(1).max(100_000),
  system: z.string().optional(),
  provider: z.enum(['anthropic', 'openai', 'workers-ai']).optional(),
  model: z.string().optional(),
  maxTokens: z.number().positive().max(32_000).optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    input_schema: z.record(z.unknown()),
  })).optional(),
})

const prompt = new Hono<{ Bindings: Env; Variables: Variables }>()

prompt.post('/v1/prompt', async (c) => {
  const body = await c.req.json()
  const parsed = promptSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.message }, 400)
  }

  const { prompt: userPrompt, system, provider, model, maxTokens, stream, tools } = parsed.data
  const resolvedProvider = (provider ?? c.env.DEFAULT_PROVIDER) as Provider
  const resolvedModel = model ?? c.env.DEFAULT_MODEL
  const resolvedMaxTokens = maxTokens ?? parseInt(c.env.DEFAULT_MAX_TOKENS, 10)

  const request = {
    provider: resolvedProvider,
    model: resolvedModel,
    system,
    messages: [{ role: 'user' as const, content: userPrompt }],
    maxTokens: resolvedMaxTokens,
    stream: stream ?? false,
    tools,
  }

  try {
    if (stream) {
      const response = await streamLLMRequest(c.env, request)
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const result = await sendLLMRequest(c.env, request)
    const projectId = c.get('projectId')
    await trackUsage(c.env, projectId, result.usage)

    return c.json({
      sessionId: '',
      text: result.text,
      content: result.content,
      usage: result.usage,
      stopReason: result.stopReason,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LLM request failed'
    return c.json({ code: 'LLM_ERROR', message }, 502)
  }
})

async function trackUsage(
  env: Env,
  projectId: string,
  usage: { inputTokens: number; outputTokens: number }
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  const key = `usage:${projectId}:${date}`
  const existing = await env.USAGE.get(key)
  const record = existing
    ? JSON.parse(existing)
    : { projectId, date, requestCount: 0, inputTokens: 0, outputTokens: 0 }
  record.requestCount += 1
  record.inputTokens += usage.inputTokens
  record.outputTokens += usage.outputTokens
  await env.USAGE.put(key, JSON.stringify(record), { expirationTtl: 90 * 86400 })
}

export { prompt }
