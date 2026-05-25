import type { Context, Next } from 'hono'
import type { Env, ProjectConfig } from '../types.js'

type Variables = { projectId: string; projectConfig: ProjectConfig }

interface RateState { count: number; resetAt: number }
interface DailyState { requests: number; inputTokens: number; outputTokens: number }

const DEFAULT_PER_MINUTE = 60
const DEFAULT_PER_DAY = 10_000
const DEFAULT_TOKENS_PER_DAY = 2_000_000

function readLimits(config: ProjectConfig): { perMinute: number; perDay: number; tokensPerDay: number } {
  const cfg = config as ProjectConfig & { rateLimitPerDay?: number; tokensPerDay?: number }
  return {
    perMinute: cfg.rateLimitPerMinute > 0 ? cfg.rateLimitPerMinute : DEFAULT_PER_MINUTE,
    perDay: (cfg.rateLimitPerDay ?? 0) > 0 ? cfg.rateLimitPerDay! : DEFAULT_PER_DAY,
    tokensPerDay: (cfg.tokensPerDay ?? 0) > 0 ? cfg.tokensPerDay! : DEFAULT_TOKENS_PER_DAY,
  }
}

async function incrementMinute(env: Env, projectId: string, now: number): Promise<number> {
  const minute = Math.floor(now / 60_000)
  const key = `rate:${projectId}:m:${minute}`
  const raw = await env.USAGE.get(key)
  const state: RateState = raw ? JSON.parse(raw) : { count: 0, resetAt: (minute + 1) * 60_000 }
  state.count += 1
  await env.USAGE.put(key, JSON.stringify(state), { expirationTtl: 120 })
  return state.count
}

async function incrementDay(env: Env, projectId: string, date: string): Promise<number> {
  const key = `rate:${projectId}:d:${date}`
  const raw = await env.USAGE.get(key)
  const state: DailyState = raw ? JSON.parse(raw) : { requests: 0, inputTokens: 0, outputTokens: 0 }
  state.requests += 1
  await env.USAGE.put(key, JSON.stringify(state), { expirationTtl: 3 * 86400 })
  return state.requests
}

async function readTokensToday(env: Env, projectId: string, date: string): Promise<number> {
  const key = `usage:${projectId}:${date}`
  const raw = await env.USAGE.get(key)
  if (!raw) return 0
  const rec = JSON.parse(raw) as { inputTokens?: number; outputTokens?: number }
  return (rec.inputTokens ?? 0) + (rec.outputTokens ?? 0)
}

function tooMany(c: Context, kind: string, limit: number, retryAfter: number): Response {
  return c.json(
    { code: 'RATE_LIMITED', message: `${kind} limit exceeded (${limit})`, retryAfter },
    429,
    { 'Retry-After': String(retryAfter) },
  )
}

export function rateLimitMiddleware() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next,
  ): Promise<Response | void> => {
    const projectId = c.get('projectId')
    const config = c.get('projectConfig')
    if (!projectId || !config) return next()

    const { perMinute, perDay, tokensPerDay } = readLimits(config)
    const now = Date.now()
    const date = new Date(now).toISOString().slice(0, 10)

    const tokensToday = await readTokensToday(c.env, projectId, date)
    if (tokensToday >= tokensPerDay) {
      return tooMany(c, 'Daily token', tokensPerDay, 3600)
    }

    const minuteCount = await incrementMinute(c.env, projectId, now)
    if (minuteCount > perMinute) {
      const secs = Math.max(1, Math.ceil((Math.floor(now / 60_000) + 1) * 60 - now / 1000))
      return tooMany(c, 'Per-minute request', perMinute, secs)
    }

    const dailyCount = await incrementDay(c.env, projectId, date)
    if (dailyCount > perDay) {
      return tooMany(c, 'Per-day request', perDay, 3600)
    }

    await next()
  }
}
