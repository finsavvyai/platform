/**
 * Tool hashing — SHA-256 over canonical JSON of (name + description + inputSchema).
 * Per-tool hash and aggregate-list hash. Used both at build time (Node) and at
 * runtime in the generated server (Web Crypto in the Worker).
 */

import { createHash } from 'node:crypto'
import { canonicalize } from './canonical.js'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolHash {
  name: string
  hash: string // sha256 hex, prefixed "sha256:"
}

export function hashTool(tool: ToolDefinition): string {
  const subset = {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }
  const hex = createHash('sha256').update(canonicalize(subset)).digest('hex')
  return `sha256:${hex}`
}

export function hashToolList(tools: ToolDefinition[]): string {
  const ordered = tools
    .map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const hex = createHash('sha256').update(canonicalize(ordered)).digest('hex')
  return `sha256:${hex}`
}

export function perToolHashes(tools: ToolDefinition[]): ToolHash[] {
  return tools.map(t => ({ name: t.name, hash: hashTool(t) }))
}
