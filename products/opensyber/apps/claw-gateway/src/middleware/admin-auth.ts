import type { Context, Next } from 'hono'
import type { Env } from '../types.js'

/**
 * Admin authentication — protects /admin/* routes behind a shared-secret
 * bearer token stored in CLAW_ADMIN_SECRET. This is intentionally simple
 * because the admin surface is small (project CRUD, key rotation) and
 * only used by operators. Upgrade path: migrate to OpenSyber JWT + RBAC
 * once more than one admin role is needed.
 */
export async function adminAuthMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  const configured = (c.env as unknown as Record<string, string | undefined>).CLAW_ADMIN_SECRET
  if (!configured) {
    return c.json(
      { code: 'NOT_CONFIGURED', message: 'Admin is disabled: CLAW_ADMIN_SECRET not set' },
      503,
    )
  }

  const header = c.req.header('Authorization') ?? ''
  if (!header.startsWith('Bearer ')) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Missing admin bearer token' }, 401)
  }
  const provided = header.slice(7)

  if (!timingSafeEqual(provided, configured)) {
    return c.json({ code: 'UNAUTHORIZED', message: 'Invalid admin token' }, 401)
  }
  await next()
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const ba = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  let diff = 0
  for (let i = 0; i < ba.length; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}
