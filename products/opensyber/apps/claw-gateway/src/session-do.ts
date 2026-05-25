import { DurableObject } from 'cloudflare:workers'
import type { Env, StoredSession, StoredMessage, Provider } from './types.js'

/**
 * Durable Object managing a single AI conversation session.
 * Uses KV storage API for messages and session metadata.
 */
export class ClawSessionDO extends DurableObject<Env> {

  /** Create a new session */
  async createSession(
    sessionId: string, projectId: string,
    provider: Provider, model: string, system?: string
  ): Promise<StoredSession> {
    const now = new Date().toISOString()
    const session: StoredSession = {
      id: sessionId, projectId, provider, model,
      system: system ?? null, status: 'active',
      createdAt: now, lastActiveAt: now,
      messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0,
    }
    await this.ctx.storage.put(`session:${sessionId}`, session)
    await this.ctx.storage.put(`msgs:${sessionId}`, [] as StoredMessage[])
    return session
  }

  /** Get session metadata */
  async getSession(sessionId: string): Promise<StoredSession> {
    const session = await this.ctx.storage.get<StoredSession>(`session:${sessionId}`)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    return session
  }

  /** Add a message to the conversation */
  async addMessage(sessionId: string, role: string, content: string): Promise<void> {
    const msgs = (await this.ctx.storage.get<StoredMessage[]>(`msgs:${sessionId}`)) ?? []
    const newMsg: StoredMessage = {
      id: msgs.length + 1, sessionId, role, content,
      createdAt: new Date().toISOString(),
    }
    msgs.push(newMsg)
    await this.ctx.storage.put(`msgs:${sessionId}`, msgs)

    const session = await this.getSession(sessionId)
    session.messageCount = msgs.length
    session.lastActiveAt = new Date().toISOString()
    await this.ctx.storage.put(`session:${sessionId}`, session)
  }

  /** Get all messages for a session */
  async getMessages(sessionId: string): Promise<StoredMessage[]> {
    return (await this.ctx.storage.get<StoredMessage[]>(`msgs:${sessionId}`)) ?? []
  }

  /** Update token usage */
  async addUsage(sessionId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const session = await this.getSession(sessionId)
    session.totalInputTokens += inputTokens
    session.totalOutputTokens += outputTokens
    session.lastActiveAt = new Date().toISOString()
    await this.ctx.storage.put(`session:${sessionId}`, session)
  }

  /**
   * Compact: keep only the last N messages + an untrusted summary.
   *
   * Summary is stored as `role: 'assistant'` with a security marker so that
   * content derived from prior *user* turns can never be promoted to the
   * system slot of future LLM calls (prompt-injection persistence).
   */
  async compact(sessionId: string, keepLast: number = 10): Promise<void> {
    const msgs = await this.getMessages(sessionId)
    if (msgs.length <= keepLast) return

    const toRemove = msgs.slice(0, msgs.length - keepLast)
    const kept = msgs.slice(msgs.length - keepLast)
    const summary = toRemove.map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')

    const summaryMsg: StoredMessage = {
      id: 0, sessionId, role: 'assistant',
      content: `[SUMMARY — untrusted, derived from prior turns]\n${summary}`,
      createdAt: new Date().toISOString(),
    }
    await this.ctx.storage.put(`msgs:${sessionId}`, [summaryMsg, ...kept])
  }

  /** Close the session */
  async closeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId)
    session.status = 'closed'
    session.lastActiveAt = new Date().toISOString()
    await this.ctx.storage.put(`session:${sessionId}`, session)
  }

  /** List all sessions for a project */
  async listSessions(projectId: string): Promise<StoredSession[]> {
    const all = await this.ctx.storage.list<StoredSession>({ prefix: 'session:' })
    const sessions: StoredSession[] = []
    for (const [, session] of all) {
      if (session.projectId === projectId && session.status !== 'closed') {
        sessions.push(session)
      }
    }
    return sessions.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt)).slice(0, 50)
  }

  /** HTTP fetch handler — routes internal requests to session methods */
  async fetch(request: Request): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url)
    try {
      return await this.handleRoute(pathname, request.method, request, searchParams)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      return Response.json({ code: 'DO_ERROR', message: msg }, { status: 500 })
    }
  }

  private async handleRoute(
    path: string, method: string, req: Request, params: URLSearchParams
  ): Promise<Response> {
    if (method === 'POST') {
      const body = await req.json() as Record<string, unknown>
      if (path === '/create') {
        const s = await this.createSession(body.sessionId as string, body.projectId as string, body.provider as Provider, body.model as string, body.system as string | undefined)
        return Response.json(s)
      }
      if (path === '/message') { await this.addMessage(body.sessionId as string, body.role as string, body.content as string); return Response.json({ ok: true }) }
      if (path === '/usage') { await this.addUsage(body.sessionId as string, body.inputTokens as number, body.outputTokens as number); return Response.json({ ok: true }) }
      if (path === '/compact') { await this.compact(body.sessionId as string); return Response.json({ ok: true }) }
      if (path === '/close') { await this.closeSession(body.sessionId as string); return Response.json({ ok: true }) }
    }
    if (method === 'GET') {
      if (path === '/messages') return Response.json({ messages: await this.getMessages(params.get('sessionId') ?? '') })
      if (path === '/session') return Response.json(await this.getSession(params.get('sessionId') ?? ''))
      if (path === '/list') return Response.json({ sessions: await this.listSessions(params.get('projectId') ?? '') })
    }
    return Response.json({ code: 'NOT_FOUND', message: 'Unknown DO route' }, { status: 404 })
  }
}
