export type JsonSchema = Record<string, unknown>

export interface WebActionExample {
  input: Record<string, unknown>
  output?: Record<string, unknown>
  note?: string
}

export interface WebAction {
  name: string
  description: string
  inputSchema: JsonSchema
  outputSchema?: JsonSchema
  navigate?: string
  handler: string
  egress?: string[]
  authRequired?: boolean
  examples?: WebActionExample[]
}

export interface WebSkillAuth {
  type: 'none' | 'cookie' | 'oauth' | 'header'
  description?: string
}

export interface WebSkill {
  id: string
  site: string
  version: string
  description: string
  baseUrl: string
  auth: WebSkillAuth
  actions: WebAction[]
}

export interface RunActionResult<T = unknown> {
  ok: boolean
  result?: T
  error?: { code: string; message: string }
  egressDomains: string[]
  durationMs: number
}

export interface SiteRegistry {
  list(): WebSkill[]
  get(id: string): WebSkill | undefined
  register(skill: WebSkill): void
}
