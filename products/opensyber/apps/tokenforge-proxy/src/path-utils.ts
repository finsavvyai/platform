/** Check if a path matches any skip pattern (static assets, health checks) */
export function shouldSkip(path: string, patterns?: string[]): boolean {
  const defaults = ['/_next/*', '/static/*', '/favicon.ico', '/robots.txt', '/sitemap.xml'];
  const all = [...defaults, ...(patterns ?? [])];
  return all.some((p) => p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p);
}

/** Check if a path matches any of the given patterns */
export function shouldMatch(path: string, patterns: string[]): boolean {
  return patterns.some((p) => p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p);
}
