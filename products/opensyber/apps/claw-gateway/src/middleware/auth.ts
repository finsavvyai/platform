import type { Context, Next } from 'hono'
import type { Env, ProjectConfig } from '../types.js'

/**
 * Validates project API key from Authorization header.
 * Stores projectId in context for downstream use.
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { projectId: string; projectConfig: ProjectConfig } }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing Bearer token' }, 401)
  }

  const apiKey = authHeader.slice(7)
  const projectId = c.req.header('X-Project-Id')
  if (!projectId) {
    return c.json({ code: 'BAD_REQUEST', message: 'Missing X-Project-Id header' }, 400)
  }

  const configRaw = await c.env.PROJECT_KEYS.get(`project:${projectId}`)
  if (!configRaw) {
    return c.json({ code: 'NOT_FOUND', message: 'Project not found' }, 404)
  }

  const config = JSON.parse(configRaw) as ProjectConfig
  if (!config.enabled) {
    return c.json({ code: 'FORBIDDEN', message: 'Project disabled' }, 403)
  }

  const keyHash = await hashApiKey(apiKey)
  if (!timingSafeEqual(keyHash, config.apiKeyHash)) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Invalid API key' }, 401)
  }

  c.set('projectId', projectId)
  c.set('projectConfig', config)
  await next()
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0)
  }
  return result === 0
}
