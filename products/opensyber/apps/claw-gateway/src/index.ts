import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env, ProjectConfig } from './types.js'
import { authMiddleware } from './middleware/auth.js'
import { rateLimitMiddleware } from './middleware/rate-limit.js'
import { health } from './routes/health.js'
import { prompt } from './routes/prompt.js'
import { sessions } from './routes/sessions.js'
import { guard } from './routes/guard.js'
import { adminRoutes } from './routes/admin.js'
import { adminUiRoutes } from './routes/admin-ui.js'

export { ClawSessionDO } from './session-do.js'

type Variables = { projectId: string; projectConfig: ProjectConfig }

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

const PROD_ORIGINS = new Set([
  'https://opensyber.cloud',
  'https://app.opensyber.cloud',
  'https://console.opensyber.cloud',
  'https://docs.opensyber.cloud',
])

app.use('*', cors({
  origin: (origin, c) => {
    if (!origin) return null
    if (PROD_ORIGINS.has(origin)) return origin
    const isDev = c.env.ENVIRONMENT !== 'production'
    if (isDev && origin.startsWith('http://localhost')) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Project-Id', 'Accept'],
  maxAge: 86400,
}))
app.use('*', logger())

// Security headers
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
})

// Public routes (no auth)
app.route('/', health)

// Admin UI + admin API (bearer-token auth, disabled if CLAW_ADMIN_SECRET unset)
app.route('/', adminUiRoutes)
app.route('/', adminRoutes)

// Protected routes (require project API key + per-project rate limits)
app.use('/v1/*', authMiddleware)
app.use('/v1/*', rateLimitMiddleware())
app.route('/', prompt)
app.route('/', guard)
app.route('/', sessions)

// 404 fallback
app.notFound((c) => {
  return c.json({ code: 'NOT_FOUND', message: `Route not found: ${c.req.path}` }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error(`[claw-gateway] ${err.message}`, err.stack)
  const isDev = c.env.ENVIRONMENT !== 'production'
  return c.json({ code: 'INTERNAL_ERROR', message: isDev ? err.message : 'Internal server error' }, 500)
})

export default app
