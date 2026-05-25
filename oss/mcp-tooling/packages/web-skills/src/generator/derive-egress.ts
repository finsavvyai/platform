import type { WebSkill } from '../types.js'

export function deriveSkillEgress(skill: WebSkill): string[] {
  const hosts = new Set<string>()
  add(hosts, skill.baseUrl)
  for (const a of skill.actions) {
    if (a.navigate) {
      const stripped = a.navigate.replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, '')
      add(hosts, stripped)
    }
    for (const e of a.egress ?? []) add(hosts, e)
    for (const url of extractUrls(a.handler)) add(hosts, url)
  }
  return [...hosts].sort()
}

function add(set: Set<string>, raw: string): void {
  const host = hostnameOf(raw)
  if (host) set.add(host)
}

function hostnameOf(raw: string): string | null {
  if (!raw) return null
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).hostname
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) return raw
    return null
  } catch {
    return null
  }
}

function extractUrls(text: string): string[] {
  const out: string[] = []
  const rx = /https?:\/\/[A-Za-z0-9.-]+/g
  let m
  while ((m = rx.exec(text)) !== null) out.push(m[0])
  return out
}
