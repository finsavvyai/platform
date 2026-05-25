/**
 * Egress derivation — pull allowed outbound domains from OpenAPI `servers`.
 * Anything not in this list is denied at runtime by the generated server.
 */

export interface OpenApiServer {
  url: string
  description?: string
}

export function deriveEgress(servers: OpenApiServer[] | undefined): string[] {
  if (!servers || servers.length === 0) return []
  const hosts = new Set<string>()
  for (const s of servers) {
    const host = hostnameOf(s.url)
    if (host) hosts.add(host)
  }
  return [...hosts].sort()
}

function hostnameOf(raw: string): string | null {
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).hostname
    return new URL(`https://${raw}`).hostname
  } catch {
    return null
  }
}

export function isEgressAllowed(targetUrl: string, allowed: string[]): boolean {
  const host = hostnameOf(targetUrl)
  if (!host) return false
  return allowed.includes(host)
}
