import type { WebSkill, SiteRegistry } from './types.js'

export function createRegistry(initial: WebSkill[] = []): SiteRegistry {
  const map = new Map<string, WebSkill>()
  for (const s of initial) map.set(s.id, s)
  return {
    list: () => [...map.values()].sort((a, b) => a.id.localeCompare(b.id)),
    get: id => map.get(id),
    register: skill => {
      if (map.has(skill.id)) {
        throw new Error(`web-skills: duplicate skill id "${skill.id}"`)
      }
      validateSkill(skill)
      map.set(skill.id, skill)
    },
  }
}

export function validateSkill(skill: WebSkill): void {
  if (!skill.id || !/^[a-z][a-z0-9-]*$/.test(skill.id)) {
    throw new Error(`web-skills: invalid skill id "${skill.id}"`)
  }
  if (!skill.baseUrl) throw new Error(`web-skills: skill "${skill.id}" missing baseUrl`)
  try {
    new URL(skill.baseUrl)
  } catch {
    throw new Error(`web-skills: skill "${skill.id}" baseUrl not a URL`)
  }
  if (!Array.isArray(skill.actions) || skill.actions.length === 0) {
    throw new Error(`web-skills: skill "${skill.id}" has no actions`)
  }
  const seen = new Set<string>()
  for (const a of skill.actions) {
    if (!/^[a-z][a-z0-9_]*$/.test(a.name)) {
      throw new Error(`web-skills: invalid action name "${a.name}" in "${skill.id}"`)
    }
    if (seen.has(a.name)) {
      throw new Error(`web-skills: duplicate action "${a.name}" in "${skill.id}"`)
    }
    seen.add(a.name)
    if (typeof a.handler !== 'string' || a.handler.length === 0) {
      throw new Error(`web-skills: action "${a.name}" missing handler`)
    }
    if (!a.inputSchema || typeof a.inputSchema !== 'object') {
      throw new Error(`web-skills: action "${a.name}" missing inputSchema`)
    }
  }
}
