/**
 * MCP Server Generator - Generates TypeScript MCP servers from parsed OpenAPI
 */

import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import type { ParsedEndpoint, ParsedSchema } from './parser.js'
import {
  buildManifest,
  generateKeypair,
  type OpenApiServer,
  type ManifestPublisher,
} from './hardened/index.js'
import { buildToolDefinitions } from './hardened/build-tools.js'
import { deriveEgress } from './hardened/egress.js'
import { renderHardenedIndex, renderHardenedTools } from './hardened/render-server.js'
import { renderHardenedExecutors } from './hardened/render-executors.js'

export interface GeneratorConfig {
  name: string
  version: string
  description: string
  endpoints: ParsedEndpoint[]
  schemas: ParsedSchema[]
  outputDir: string
  transport: 'stdio' | 'http'
  hardened?: boolean
  publisher?: ManifestPublisher
  servers?: OpenApiServer[]
  oauthScopes?: string[]
}

export interface GeneratorResult {
  success: boolean
  files: string[]
  errors: string[]
}

export async function generateMCPServer(config: GeneratorConfig): Promise<GeneratorResult> {
  const files: string[] = []
  const errors: string[] = []

  try {
    // Create output directory
    await mkdir(config.outputDir, { recursive: true })
    await mkdir(path.join(config.outputDir, 'src'), { recursive: true })

    // Generate package.json
    const packageJson = generatePackageJson(config)
    await writeFile(path.join(config.outputDir, 'package.json'), packageJson)
    files.push('package.json')

    // Generate tsconfig.json
    const tsConfig = generateTsConfig()
    await writeFile(path.join(config.outputDir, 'tsconfig.json'), tsConfig)
    files.push('tsconfig.json')

    if (config.hardened) {
      await emitHardenedArtifacts(config, files)
    } else {
      const indexTs = generateIndex(config)
      await writeFile(path.join(config.outputDir, 'src', 'index.ts'), indexTs)
      files.push('src/index.ts')
      const toolsTs = generateTools(config)
      await writeFile(path.join(config.outputDir, 'src', 'tools.ts'), toolsTs)
      files.push('src/tools.ts')
    }

    // Generate types
    const typesTs = generateTypes(config)
    await writeFile(path.join(config.outputDir, 'src', 'types.ts'), typesTs)
    files.push('src/types.ts')

    // Generate README
    const readme = generateReadme(config)
    await writeFile(path.join(config.outputDir, 'README.md'), readme)
    files.push('README.md')

    return { success: true, files, errors }
  } catch (error) {
    errors.push((error as Error).message)
    return { success: false, files, errors }
  }
}

async function emitHardenedArtifacts(config: GeneratorConfig, files: string[]): Promise<void> {
  const toolDefs = buildToolDefinitions(config.endpoints)
  const egress = deriveEgress(config.servers)
  const publisher: ManifestPublisher = config.publisher ?? { name: 'unknown-publisher' }
  const keys = generateKeypair()

  const manifest = buildManifest({
    publisher,
    serverName: config.name,
    serverVersion: config.version,
    tools: toolDefs,
    egress,
    oauthScopes: config.oauthScopes ?? [],
    publicKeyB64: keys.publicKeyB64,
    privateKeyPem: keys.privateKeyPem,
  })

  await writeFile(path.join(config.outputDir, 'tools.json'), JSON.stringify(toolDefs, null, 2))
  files.push('tools.json')
  await writeFile(
    path.join(config.outputDir, 'mcp-manifest.json'),
    JSON.stringify(manifest, null, 2)
  )
  files.push('mcp-manifest.json')

  await mkdir(path.join(config.outputDir, 'keys'), { recursive: true })
  await writeFile(path.join(config.outputDir, 'keys', 'publisher.pub'), keys.publicKeyPem)
  await writeFile(path.join(config.outputDir, 'keys', 'publisher.key'), keys.privateKeyPem, {
    mode: 0o600,
  })
  await writeFile(
    path.join(config.outputDir, 'keys', 'README.md'),
    '# Publisher keys\n\n`publisher.key` is the Ed25519 signing key for `mcp-manifest.json`. Keep it out of VCS — store in a secret manager and re-sign on any tool list change.\n'
  )
  files.push('keys/publisher.pub', 'keys/publisher.key', 'keys/README.md')

  await writeFile(
    path.join(config.outputDir, 'src', 'index.ts'),
    renderHardenedIndex(config.name, config.version)
  )
  files.push('src/index.ts')
  await writeFile(path.join(config.outputDir, 'src', 'tools.ts'), renderHardenedTools())
  files.push('src/tools.ts')
  await writeFile(
    path.join(config.outputDir, 'src', 'executors.ts'),
    renderHardenedExecutors(config.endpoints)
  )
  files.push('src/executors.ts')
}

function generatePackageJson(config: GeneratorConfig): string {
  const pkg = {
    name: config.name,
    version: config.version,
    description: config.description || `MCP server for ${config.name}`,
    type: 'module',
    main: './dist/index.js',
    bin: {
      [config.name]: './dist/index.js',
    },
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js',
      dev: 'tsc --watch',
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0',
      zod: '^3.23.8',
    },
    devDependencies: {
      '@types/node': '^20.14.0',
      typescript: '^5.5.0',
    },
    engines: {
      node: '>=18.0.0',
    },
  }
  return JSON.stringify(pkg, null, 2)
}

function generateTsConfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }
  return JSON.stringify(tsconfig, null, 2)
}

function generateIndex(config: GeneratorConfig): string {
  return `#!/usr/bin/env node
/**
 * ${config.name} - MCP Server
 * ${config.description}
 * 
 * Generated by MCPOverflow
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, executeTool } from "./tools.js";

const server = new Server(
  {
    name: "${config.name}",
    version: "${config.version}",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Execute tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const result = await executeTool(name, args || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: \`Error: \${(error as Error).message}\` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("${config.name} MCP server running on stdio");
}

main().catch(console.error);
`
}

function generateTools(config: GeneratorConfig): string {
  const toolDefinitions = config.endpoints.map(ep => generateToolDefinition(ep))
  const toolExecutors = config.endpoints.map(ep => generateToolExecutor(ep))

  return `/**
 * MCP Tools - Generated from OpenAPI specification
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Tool definitions
export const tools: Tool[] = [
${toolDefinitions.join(',\n')}
];

// Tool name to executor mapping
const toolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
${config.endpoints.map(ep => `  "${ep.operationId}": execute_${sanitizeName(ep.operationId)}`).join(',\n')}
};

// Main executor
export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const executor = toolExecutors[name];
  if (!executor) {
    throw new Error(\`Unknown tool: \${name}\`);
  }
  return executor(args);
}

// Individual tool executors
${toolExecutors.join('\n\n')}
`
}

function generateToolDefinition(ep: ParsedEndpoint): string {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  // Add path/query parameters
  for (const param of ep.parameters) {
    properties[param.name] = {
      type: schemaToJsonType(param.schema),
      description: param.description || `${param.in} parameter: ${param.name}`,
    }
    if (param.required) {
      required.push(param.name)
    }
  }

  // Add request body if present
  if (ep.requestBody?.content?.['application/json']?.schema) {
    properties.body = {
      type: 'object',
      description: ep.requestBody.description || 'Request body',
    }
    if (ep.requestBody.required) {
      required.push('body')
    }
  }

  return `  {
    name: "${ep.operationId}",
    description: ${JSON.stringify(ep.description || ep.summary || `${ep.method} ${ep.path}`)},
    inputSchema: {
      type: "object",
      properties: ${JSON.stringify(properties, null, 6).split('\n').join('\n      ')},
      required: ${JSON.stringify(required)},
    },
  }`
}

function generateToolExecutor(ep: ParsedEndpoint): string {
  const funcName = sanitizeName(ep.operationId)

  // Build URL with path parameters
  let urlTemplate = ep.path
  const pathParams = ep.parameters.filter(p => p.in === 'path')
  for (const param of pathParams) {
    urlTemplate = urlTemplate.replace(`{${param.name}}`, `\${args.${param.name}}`)
  }

  // Query parameters
  const queryParams = ep.parameters.filter(p => p.in === 'query')
  const queryParamsCode =
    queryParams.length > 0
      ? `
  const queryParams = new URLSearchParams();
  ${queryParams.map(p => `if (args.${p.name} !== undefined) queryParams.set("${p.name}", String(args.${p.name}));`).join('\n  ')}
  const queryString = queryParams.toString();
  const fullUrl = queryString ? \`\${url}?\${queryString}\` : url;`
      : `const fullUrl = url;`

  // Request body
  const hasBody = ep.requestBody?.content?.['application/json']
  const bodyCode = hasBody ? `body: args.body ? JSON.stringify(args.body) : undefined,` : ''

  return `async function execute_${funcName}(args: Record<string, unknown>): Promise<unknown> {
  // TODO: Configure your base URL
  const BASE_URL = process.env.API_BASE_URL || "https://api.example.com";
  const url = \`\${BASE_URL}${urlTemplate}\`;
  ${queryParamsCode}
  
  const response = await fetch(fullUrl, {
    method: "${ep.method}",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication headers
      // "Authorization": \`Bearer \${process.env.API_KEY}\`,
    },
    ${bodyCode}
  });
  
  if (!response.ok) {
    throw new Error(\`API error: \${response.status} \${response.statusText}\`);
  }
  
  return response.json();
}`
}

function generateTypes(config: GeneratorConfig): string {
  const schemaTypes = config.schemas.map(s => generateSchemaType(s)).join('\n\n')

  return `/**
 * TypeScript types - Generated from OpenAPI schemas
 */

${schemaTypes || '// No schemas defined in OpenAPI specification'}

// Utility types
export type ApiResponse<T> = {
  data: T;
  error?: string;
};
`
}

function generateSchemaType(schema: ParsedSchema): string {
  const props = Object.entries(schema.properties)
    .map(([name, prop]: [string, unknown]) => {
      const p = prop as { description?: string }
      const optional = !schema.required.includes(name) ? '?' : ''
      const type = schemaToTsType(prop)
      const description = p.description ? `  /** ${p.description} */\n` : ''
      return `${description}  ${name}${optional}: ${type};`
    })
    .join('\n')

  const description = schema.description ? `/** ${schema.description} */\n` : ''
  return `${description}export interface ${schema.name} {\n${props}\n}`
}

function schemaToTsType(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return 'unknown'
  const s = schema as { type?: string; items?: unknown; properties?: Record<string, unknown> }

  switch (s.type) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return `${schemaToTsType(s.items)}[]`
    case 'object':
      if (s.properties) {
        const props = Object.entries(s.properties)
          .map(([k, v]) => `${k}: ${schemaToTsType(v)}`)
          .join('; ')
        return `{ ${props} }`
      }
      return 'Record<string, unknown>'
    default:
      return 'unknown'
  }
}

function schemaToJsonType(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return 'string'
  const s = schema as { type?: string }

  switch (s.type) {
    case 'integer':
      return 'number'
    case 'array':
      return 'array'
    default:
      return s.type || 'string'
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&')
}

function generateReadme(config: GeneratorConfig): string {
  const toolsList = config.endpoints
    .map(
      ep => `- **${ep.operationId}**: ${ep.description || ep.summary || `${ep.method} ${ep.path}`}`
    )
    .join('\n')

  return `# ${config.name}

${config.description}

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

### With Claude Desktop

Add to your Claude Desktop config (\`~/Library/Application Support/Claude/claude_desktop_config.json\`):

\`\`\`json
{
  "mcpServers": {
    "${config.name}": {
      "command": "node",
      "args": ["${config.outputDir}/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://api.example.com",
        "API_KEY": "your-api-key"
      }
    }
  }
}
\`\`\`

### Standalone

\`\`\`bash
npm start
\`\`\`

## Available Tools

${toolsList}

## Configuration

Set the following environment variables:

- \`API_BASE_URL\`: Base URL for the API (default: https://api.example.com)
- \`API_KEY\`: API authentication key

## Generated by MCPOverflow

This MCP server was automatically generated from an OpenAPI specification.
Learn more at https://mcpoverflow.com
`
}
