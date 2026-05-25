// SHA-256 fingerprint of an MCP tool definition.
// Hashes name + description + canonicalized inputSchema so key-ordering or
// whitespace shifts inside the schema still produce a stable digest until the
// SEMANTICS change.

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: unknown;
}

/** Recursively sort object keys for a stable JSON serialization. */
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => [k, canonicalize(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** SHA-256 hex digest of the canonical (name, description, inputSchema) tuple. */
export async function fingerprintTool(tool: ToolDef): Promise<string> {
  const payload = canonicalJson({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  });
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
