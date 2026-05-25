import { Hono } from 'hono'
import { z } from 'zod'
import type { Env, Provider } from '../types.js'
import { sendLLMRequest, streamLLMRequest } from '../services/llm-proxy.js'

type Variables = { projectId: string }

const createSessionSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'workers-ai']).optional(),
  model: z.string().optional(),
  system: z.string().optional(),
})

const messageSchema = z.object({
  prompt: z.string().min(1).max(100_000),
  stream: z.boolean().optional(),
  provider: z.enum(['anthropic', 'openai', 'workers-ai']).optional(),
  model: z.string().optional(),
  maxTokens: z.number().positive().max(32_000).optional(),
})

const sessions = new Hono<{ Bindings: Env; Variables: Variables }>()

/** Create a new session */
sessions.post('/v1/sessions', async (c) => {
  const body = await c.req.json()
  const parsed = createSessionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.message }, 400)
  }

  const projectId = c.get('projectId')
  const sessionId = crypto.randomUUID()
  const provider = (parsed.data.provider ?? c.env.DEFAULT_PROVIDER) as Provider
  const model = parsed.data.model ?? c.env.DEFAULT_MODEL

  const doId = c.env.CLAW_SESSION.idFromName(`${projectId}:${sessionId}`)
  const stub = c.env.CLAW_SESSION.get(doId)

  const doResponse = await stub.fetch(new Request('http://do/create', {
    method: 'POST',
    body: JSON.stringify({ sessionId, projectId, provider, model, system: parsed.data.system }),
  }))

  if (!doResponse.ok) {
    const doErr = await doResponse.text()
    return c.json({ code: 'SESSION_ERROR', message: `Failed to create session: ${doErr}` }, 500)
  }

  return c.json({ sessionId })
})

/** List active sessions */
sessions.get('/v1/sessions', async (c) => {
  const projectId = c.get('projectId')
  const doId = c.env.CLAW_SESSION.idFromName(`${projectId}:index`)
  const stub = c.env.CLAW_SESSION.get(doId)
  const response = await stub.fetch(new Request(`http://do/list?projectId=${projectId}`))
  const data = await response.json()
  return c.json(data)
})

/** Send message to session */
sessions.post('/v1/sessions/:id/message', async (c) => {
  const sessionId = c.req.param('id')
  const body = await c.req.json()
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.message }, 400)
  }

  const projectId = c.get('projectId')
  const doId = c.env.CLAW_SESSION.idFromName(`${projectId}:${sessionId}`)
  const stub = c.env.CLAW_SESSION.get(doId)

  // Store user message
  await stub.fetch(new Request('http://do/message', {
    method: 'POST',
    body: JSON.stringify({ sessionId, role: 'user', content: parsed.data.prompt }),
  }))

  // Get session info for provider/model
  const sessionResp = await stub.fetch(new Request(`http://do/session?sessionId=${sessionId}`))
  const session = await sessionResp.json() as { provider: Provider; model: string; system: string | null }

  // Get message history
  const msgsResp = await stub.fetch(new Request(`http://do/messages?sessionId=${sessionId}`))
  const { messages } = await msgsResp.json() as { messages: Array<{ role: string; content: string }> }

  const llmMessages = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  const provider = (parsed.data.provider ?? session.provider) as Provider
  const model = parsed.data.model ?? session.model
  const maxTokens = parsed.data.maxTokens ?? parseInt(c.env.DEFAULT_MAX_TOKENS, 10)

  const request = {
    provider, model, system: session.system ?? undefined,
    messages: llmMessages, maxTokens, stream: parsed.data.stream ?? false,
  }

  try {
    if (parsed.data.stream) {
      const response = await streamLLMRequest(c.env, request)
      return new Response(response.body, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    const result = await sendLLMRequest(c.env, request)

    // Store assistant response + usage
    await stub.fetch(new Request('http://do/message', {
      method: 'POST',
      body: JSON.stringify({ sessionId, role: 'assistant', content: result.text }),
    }))
    await stub.fetch(new Request('http://do/usage', {
      method: 'POST',
      body: JSON.stringify({ sessionId, ...result.usage }),
    }))

    return c.json({
      sessionId, text: result.text, content: result.content,
      usage: result.usage, stopReason: result.stopReason,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'LLM request failed'
    return c.json({ code: 'LLM_ERROR', message: msg }, 502)
  }
})

/** Get session details */
sessions.get('/v1/sessions/:id', async (c) => {
  const sessionId = c.req.param('id')
  const projectId = c.get('projectId')
  const doId = c.env.CLAW_SESSION.idFromName(`${projectId}:${sessionId}`)
  const stub = c.env.CLAW_SESSION.get(doId)
  const msgsResp = await stub.fetch(new Request(`http://do/messages?sessionId=${sessionId}`))
  return new Response(msgsResp.body, { headers: { 'Content-Type': 'application/json' } })
})

/** Compact session history */
sessions.post('/v1/sessions/:id/compact', async (c) => {
  const sessionId = c.req.param('id')
  const projectId = c.get('projectId')
  const doId = c.env.CLAW_SESSION.idFromName(`${projectId}:${sessionId}`)
  const stub = c.env.CLAW_SESSION.get(doId)
  await stub.fetch(new Request('http://do/compact', { method: 'POST', body: JSON.stringify({ sessionId }) }))
  return c.json({ ok: true })
})

/** Get session info */
sessions.get('/v1/sessions/:id/info', async (c) => {
  const sessionId = c.req.param('id')
  const projectId = c.get('projectId')
  const doId = c.env.CLAW_SESSION.idFromName(`${projectId}:${sessionId}`)
  const stub = c.env.CLAW_SESSION.get(doId)
  const resp = await stub.fetch(new Request(`http://do/session?sessionId=${sessionId}`))
  return new Response(resp.body, { headers: { 'Content-Type': 'application/json' } })
})

/** Close session */
sessions.delete('/v1/sessions/:id', async (c) => {
  const sessionId = c.req.param('id')
  const projectId = c.get('projectId')
  const doId = c.env.CLAW_SESSION.idFromName(`${projectId}:${sessionId}`)
  const stub = c.env.CLAW_SESSION.get(doId)
  await stub.fetch(new Request('http://do/close', { method: 'POST', body: JSON.stringify({ sessionId }) }))
  return c.json({ ok: true })
})

export { sessions }
