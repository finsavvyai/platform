/**
 * Canonical JSON serialization — deterministic output for hashing/signing.
 * Object keys sorted lexicographically at every depth. Array order preserved.
 */

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(value))
}

function normalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(normalize)
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = normalize((value as Record<string, unknown>)[key])
  }
  return sorted
}
