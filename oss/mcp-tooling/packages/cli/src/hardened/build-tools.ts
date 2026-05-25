/**
 * Build canonical tool definitions from parsed OpenAPI endpoints.
 * Same shape the MCP SDK expects; also the input to hashing/signing.
 */

import type { ParsedEndpoint } from '../parser.js'
import type { ToolDefinition } from './hash.js'

export function buildToolDefinitions(endpoints: ParsedEndpoint[]): ToolDefinition[] {
  return endpoints.map(ep => {
    const properties: Record<string, unknown> = {}
    const required: string[] = []

    for (const param of ep.parameters) {
      properties[param.name] = {
        type: schemaToJsonType(param.schema),
        description: param.description || `${param.in} parameter: ${param.name}`,
      }
      if (param.required) required.push(param.name)
    }

    if (ep.requestBody?.content?.['application/json']?.schema) {
      properties.body = {
        type: 'object',
        description: ep.requestBody.description || 'Request body',
      }
      if (ep.requestBody.required) required.push('body')
    }

    return {
      name: ep.operationId,
      description: ep.description || ep.summary || `${ep.method} ${ep.path}`,
      inputSchema: { type: 'object', properties, required },
    }
  })
}

function schemaToJsonType(schema: Record<string, unknown>): string {
  if (!schema) return 'string'
  const t = (schema as { type?: string }).type
  if (t === 'integer') return 'number'
  if (t === 'array') return 'array'
  return t || 'string'
}
