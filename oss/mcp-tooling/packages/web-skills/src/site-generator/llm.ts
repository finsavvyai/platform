import type { WebSkill, WebAction } from '../types.js'

export interface LlmClient {
  complete(prompt: string, opts?: { maxTokens?: number }): Promise<string>
}

export interface RefineOpts {
  llm: LlmClient
  sampleHtml?: string
  hintGoal?: string
  maxActions?: number
}

const SYSTEM_RULES = [
  'You refine an auto-generated browser skill.',
  'Output JSON only: { "description": string, "actions": [{ "name": string, "description": string }] }.',
  'Names must be snake_case, lowercase, start with a letter.',
  'Keep at most maxActions entries; preserve original action ordering.',
  'Never invent actions that were not in the input.',
].join(' ')

export async function refineSkillWithLlm(skill: WebSkill, opts: RefineOpts): Promise<WebSkill> {
  const max = opts.maxActions ?? skill.actions.length
  const payload = {
    site: skill.site,
    baseUrl: skill.baseUrl,
    currentDescription: skill.description,
    actions: skill.actions.slice(0, max).map(a => ({
      name: a.name,
      description: a.description,
    })),
    hintGoal: opts.hintGoal ?? null,
    sampleHtmlExcerpt: opts.sampleHtml?.slice(0, 4000) ?? null,
  }

  const prompt = `${SYSTEM_RULES}\nINPUT:\n${JSON.stringify(payload, null, 2)}`
  const raw = await opts.llm.complete(prompt, { maxTokens: 800 })
  const refined = safeParseRefinement(raw)
  if (!refined) return skill

  const byName = new Map<string, WebAction>()
  for (const a of skill.actions) byName.set(a.name, a)

  const newActions: WebAction[] = []
  for (const r of refined.actions) {
    if (!isSnakeCase(r.name)) continue
    const original = findOriginal(byName, r.name) ?? skill.actions[newActions.length]
    if (!original) continue
    newActions.push({
      ...original,
      name: r.name,
      description: r.description?.trim() || original.description,
    })
  }
  if (newActions.length === 0) return skill

  return {
    ...skill,
    description: refined.description?.trim() || skill.description,
    actions: newActions,
  }
}

interface RefinementShape {
  description?: string
  actions: Array<{ name: string; description?: string }>
}

function safeParseRefinement(raw: string): RefinementShape | null {
  const cleaned = stripFences(raw).trim()
  try {
    const parsed = JSON.parse(cleaned) as RefinementShape
    if (!parsed || !Array.isArray(parsed.actions)) return null
    return parsed
  } catch {
    return null
  }
}

function stripFences(raw: string): string {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return m ? m[1] : raw
}

function isSnakeCase(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name)
}

function findOriginal(map: Map<string, WebAction>, refinedName: string): WebAction | undefined {
  if (map.has(refinedName)) return map.get(refinedName)
  for (const [k, v] of map) {
    if (k.replace(/_/g, '') === refinedName.replace(/_/g, '')) return v
  }
  return undefined
}
