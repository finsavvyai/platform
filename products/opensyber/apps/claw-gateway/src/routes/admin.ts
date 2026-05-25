import { Hono } from 'hono'
import { z } from 'zod'
import type { Env, ProjectConfig, Provider } from '../types.js'
import { adminAuthMiddleware } from '../middleware/admin-auth.js'

type AdminEnv = { Bindings: Env }

const PROJECT_PREFIX = 'project:'
const KEY_PREFIX = 'claw_'

const admin = new Hono<AdminEnv>()
// Scope middleware to /admin/* only. A bare '*' would intercept every
// request because this sub-app is mounted at root, which would break
// /v1/* routes with an admin-auth 401.
admin.use('/admin/*', adminAuthMiddleware)

const providerEnum = z.enum(['anthropic', 'openai', 'workers-ai'])

const createSchema = z.object({
  projectId: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'projectId must be kebab-case'),
  name: z.string().min(1).max(128),
  defaultProvider: providerEnum.optional(),
  defaultModel: z.string().min(1).max(128).optional(),
  maxTokensPerRequest: z.number().int().positive().max(32_000).optional(),
  rateLimitPerMinute: z.number().int().positive().max(10_000).optional(),
  rateLimitPerDay: z.number().int().positive().max(1_000_000).optional(),
  tokensPerDay: z.number().int().positive().max(100_000_000).optional(),
  enabled: z.boolean().optional(),
})

const updateSchema = createSchema.partial().omit({ projectId: true })

async function generateApiKey(): Promise<{ raw: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = KEY_PREFIX + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  const hashBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)),
  )
  const hash = Array.from(hashBytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  return { raw, hash }
}

function redact(config: ProjectConfig): Omit<ProjectConfig, 'apiKeyHash'> & { apiKeyHashPreview: string } {
  const { apiKeyHash, ...rest } = config
  return { ...rest, apiKeyHashPreview: apiKeyHash.slice(0, 16) + '…' }
}

async function loadProject(env: Env, projectId: string): Promise<ProjectConfig | null> {
  const raw = await env.PROJECT_KEYS.get(`${PROJECT_PREFIX}${projectId}`)
  if (!raw) return null
  return JSON.parse(raw) as ProjectConfig
}

async function saveProject(env: Env, config: ProjectConfig): Promise<void> {
  await env.PROJECT_KEYS.put(`${PROJECT_PREFIX}${config.projectId}`, JSON.stringify(config))
}

admin.get('/admin/projects', async (c) => {
  const list = await c.env.PROJECT_KEYS.list({ prefix: PROJECT_PREFIX })
  const projects: Array<Omit<ProjectConfig, 'apiKeyHash'> & { apiKeyHashPreview: string }> = []
  for (const { name } of list.keys) {
    const raw = await c.env.PROJECT_KEYS.get(name)
    if (raw) projects.push(redact(JSON.parse(raw) as ProjectConfig))
  }
  return c.json({ projects })
})

admin.post('/admin/projects', async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
  }
  const body = parsed.data
  if (await loadProject(c.env, body.projectId)) {
    return c.json({ code: 'CONFLICT', message: `Project ${body.projectId} already exists` }, 409)
  }
  const { raw, hash } = await generateApiKey()
  const config: ProjectConfig = {
    projectId: body.projectId,
    name: body.name,
    apiKeyHash: hash,
    defaultProvider: (body.defaultProvider ?? c.env.DEFAULT_PROVIDER) as Provider,
    defaultModel: body.defaultModel ?? c.env.DEFAULT_MODEL,
    maxTokensPerRequest: body.maxTokensPerRequest ?? parseInt(c.env.DEFAULT_MAX_TOKENS, 10),
    rateLimitPerMinute: body.rateLimitPerMinute ?? 60,
    rateLimitPerDay: body.rateLimitPerDay,
    tokensPerDay: body.tokensPerDay,
    enabled: body.enabled ?? true,
  }
  await saveProject(c.env, config)
  c.header('Cache-Control', 'no-store')
  return c.json({ project: redact(config), apiKey: raw }, 201)
})

admin.get('/admin/projects/:id', async (c) => {
  const config = await loadProject(c.env, c.req.param('id'))
  if (!config) return c.json({ code: 'NOT_FOUND', message: 'Project not found' }, 404)
  return c.json({ project: redact(config) })
})

admin.patch('/admin/projects/:id', async (c) => {
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
  }
  const config = await loadProject(c.env, c.req.param('id'))
  if (!config) return c.json({ code: 'NOT_FOUND', message: 'Project not found' }, 404)
  const merged: ProjectConfig = {
    ...config,
    ...parsed.data,
    defaultProvider: (parsed.data.defaultProvider ?? config.defaultProvider) as Provider,
  }
  await saveProject(c.env, merged)
  return c.json({ project: redact(merged) })
})

admin.post('/admin/projects/:id/rotate-key', async (c) => {
  const config = await loadProject(c.env, c.req.param('id'))
  if (!config) return c.json({ code: 'NOT_FOUND', message: 'Project not found' }, 404)
  const { raw, hash } = await generateApiKey()
  const rotated: ProjectConfig = { ...config, apiKeyHash: hash }
  await saveProject(c.env, rotated)
  c.header('Cache-Control', 'no-store')
  return c.json({ project: redact(rotated), apiKey: raw })
})

admin.delete('/admin/projects/:id', async (c) => {
  const id = c.req.param('id')
  const existed = await loadProject(c.env, id)
  if (!existed) return c.json({ code: 'NOT_FOUND', message: 'Project not found' }, 404)
  await c.env.PROJECT_KEYS.delete(`${PROJECT_PREFIX}${id}`)
  return c.json({ deleted: true, projectId: id })
})

admin.get('/admin/projects/:id/usage', async (c) => {
  const id = c.req.param('id')
  if (!(await loadProject(c.env, id))) {
    return c.json({ code: 'NOT_FOUND', message: 'Project not found' }, 404)
  }
  const today = new Date().toISOString().slice(0, 10)
  const raw = await c.env.USAGE.get(`usage:${id}:${today}`)
  return c.json({ projectId: id, date: today, usage: raw ? JSON.parse(raw) : null })
})

export { admin as adminRoutes }
