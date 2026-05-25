/**
 * MCP Generator Route
 * Generates MCP servers from OpenAPI specifications
 */

import { Hono } from 'hono';
import type { Env } from '../middleware/auth';

export const generateRouter = new Hono<{ Bindings: Env }>();

// Type definitions
interface OpenAPISpec {
  openapi?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths?: Record<string, Record<string, any>>;
}

interface ExtractedEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  tags?: string[];
  security?: any[];
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface GenerationResult {
  success: boolean;
  files: Array<{
    name: string;
    content: string;
  }>;
  manifest: {
    name: string;
    version: string;
    tools: MCPTool[];
  };
  errors?: string[];
}

// Parse OpenAPI spec and extract endpoints
function parseOpenAPISpec(spec: OpenAPISpec): ExtractedEndpoint[] {
  const endpoints: ExtractedEndpoint[] = [];
  
  if (!spec.paths) return endpoints;
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    // Skip internal/admin paths
    if (path.includes('/internal') || path.includes('/admin') || path.includes('/health')) {
      continue;
    }
    
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const operation = pathItem[method];
      if (!operation) continue;
      
      endpoints.push({
        path,
        method,
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        parameters: operation.parameters,
        requestBody: operation.requestBody,
        responses: operation.responses,
        tags: operation.tags,
        security: operation.security,
      });
    }
  }
  
  return endpoints;
}

// Generate tool name from endpoint
function generateToolName(endpoint: ExtractedEndpoint): string {
  if (endpoint.operationId) {
    return endpoint.operationId
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  
  const pathParts = endpoint.path
    .split('/')
    .filter(p => p && !p.startsWith('{'))
    .map(p => p.replace(/[^a-zA-Z0-9]/g, ''));
  
  return `${endpoint.method}_${pathParts.join('_')}`.toLowerCase();
}

// Convert endpoint to MCP tool
function endpointToTool(endpoint: ExtractedEndpoint): MCPTool {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  
  // Extract parameters
  if (endpoint.parameters) {
    for (const param of endpoint.parameters) {
      properties[param.name] = {
        type: mapSchemaType(param.schema?.type),
        description: param.description || `Parameter: ${param.name}`,
      };
      if (param.required) {
        required.push(param.name);
      }
    }
  }
  
  // Extract request body properties
  if (endpoint.requestBody?.content?.['application/json']?.schema) {
    const schema = endpoint.requestBody.content['application/json'].schema;
    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        const p = prop as any;
        properties[name] = {
          type: mapSchemaType(p.type),
          description: p.description || `Property: ${name}`,
        };
        if (schema.required?.includes(name)) {
          required.push(name);
        }
      }
    }
  }
  
  return {
    name: generateToolName(endpoint),
    description: endpoint.description || endpoint.summary || `${endpoint.method.toUpperCase()} ${endpoint.path}`,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

// Map OpenAPI types to JSON Schema types
function mapSchemaType(type?: string): string {
  switch (type) {
    case 'integer': return 'number';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'array': return 'array';
    case 'object': return 'object';
    default: return 'string';
  }
}

// Generate TypeScript MCP server code
function generateServerCode(
  serviceName: string,
  version: string,
  baseUrl: string,
  tools: MCPTool[],
  endpoints: ExtractedEndpoint[],
  authType: string = 'api_key'
): string {
  const envVar = serviceName.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const serverName = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  const toolDefinitions = tools.map(tool => `  {
    name: '${tool.name}',
    description: ${JSON.stringify(tool.description)},
    inputSchema: ${JSON.stringify(tool.inputSchema, null, 4).replace(/\n/g, '\n    ')},
  }`).join(',\n');
  
  const toolHandlers = endpoints.map(endpoint => {
    const toolName = generateToolName(endpoint);
    const funcName = toolName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const method = endpoint.method.toUpperCase();
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && endpoint.requestBody;
    
    return `async function ${funcName}(args: Record<string, any>): Promise<any> {
  return await apiRequest('${method}', '${endpoint.path}', args${hasBody ? ', args.body || args' : ''});
}`;
  }).join('\n\n');
  
  const toolCases = endpoints.map(endpoint => {
    const toolName = generateToolName(endpoint);
    const funcName = toolName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return `      case '${toolName}':
        return await ${funcName}(args);`;
  }).join('\n');

  return `#!/usr/bin/env npx tsx
/**
 * ${serviceName} MCP Server
 * Generated by MCPOverflow (https://mcpoverflow.com)
 * Version: ${version}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Configuration
const BASE_URL = process.env.${envVar}_BASE_URL || '${baseUrl}';
const API_KEY = process.env.${envVar}_API_KEY || '';

// HTTP client
async function apiRequest(
  method: string,
  path: string,
  params: Record<string, any> = {},
  body?: any
): Promise<any> {
  let url = \`\${BASE_URL}\${path}\`;
  
  // Replace path parameters
  for (const [key, value] of Object.entries(params)) {
    if (path.includes(\`{\${key}}\`)) {
      url = url.replace(\`{\${key}}\`, encodeURIComponent(String(value)));
      delete params[key];
    }
  }
  
  // Query params for GET/DELETE
  if (['GET', 'DELETE'].includes(method) && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    url += \`?\${searchParams.toString()}\`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': '${serverName}-mcp/${version}',
  };

  if (API_KEY) {
    headers['Authorization'] = ${authType === 'bearer' ? '`Bearer ${API_KEY}`' : 'API_KEY'};
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(\`API error \${response.status}: \${errorText}\`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}

// Tool definitions
const tools: Tool[] = [
${toolDefinitions}
];

// Tool handlers
${toolHandlers}

// Create server
const server = new Server(
  { name: '${serverName}-mcp', version: '${version}' },
  { capabilities: { tools: {} } }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;
    
    switch (name) {
${toolCases}
      default:
        throw new Error(\`Unknown tool: \${name}\`);
    }

    return {
      content: [{
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: \`Error: \${error instanceof Error ? error.message : 'Unknown error'}\`,
      }],
      isError: true,
    };
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
console.error('${serviceName} MCP server running on stdio');
`;
}

// Generate package.json
function generatePackageJson(serviceName: string, version: string): string {
  const name = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return JSON.stringify({
    name: `${name}-mcp`,
    version,
    description: `MCP server for ${serviceName}`,
    type: 'module',
    main: 'server.ts',
    bin: { [name]: './server.ts' },
    scripts: {
      start: 'npx tsx server.ts',
      build: 'tsc'
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0',
      tsx: '^4.0.0'
    }
  }, null, 2);
}

// Generate README
function generateReadme(serviceName: string, version: string, tools: MCPTool[]): string {
  const envVar = serviceName.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const name = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const toolList = tools.map(t => `- \`${t.name}\`: ${t.description}`).join('\n');
  
  return `# ${serviceName} MCP Server

Generated by [MCPOverflow](https://mcpoverflow.com)

## Setup

\`\`\`bash
npm install
export ${envVar}_API_KEY="your-api-key"
npm start
\`\`\`

## Claude Desktop Config

\`\`\`json
{
  "mcpServers": {
    "${name}": {
      "command": "npx",
      "args": ["tsx", "server.ts"],
      "env": { "${envVar}_API_KEY": "your-key" }
    }
  }
}
\`\`\`

## Tools

${toolList}
`;
}

// Main generation endpoint - PUBLIC (no auth required)
generateRouter.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      spec?: OpenAPISpec;
      specUrl?: string;
      serviceName?: string;
      version?: string;
      authType?: string;
    }>();

    let spec = body.spec;
    
    // Fetch spec from URL if provided
    if (!spec && body.specUrl) {
      const response = await fetch(body.specUrl);
      if (!response.ok) {
        return c.json({ error: 'Failed to fetch OpenAPI spec' }, 400);
      }
      const text = await response.text();
      try {
        spec = JSON.parse(text);
      } catch {
        // Try YAML parsing (basic)
        return c.json({ error: 'Invalid OpenAPI spec format. Please provide JSON.' }, 400);
      }
    }

    if (!spec || !spec.paths) {
      return c.json({ error: 'Invalid or missing OpenAPI specification' }, 400);
    }

    // Extract info
    const serviceName = body.serviceName || spec.info?.title || 'API';
    const version = body.version || spec.info?.version || '1.0.0';
    const baseUrl = spec.servers?.[0]?.url || 'https://api.example.com';
    const authType = body.authType || 'api_key';

    // Parse endpoints
    const endpoints = parseOpenAPISpec(spec);
    
    if (endpoints.length === 0) {
      return c.json({ error: 'No valid endpoints found in the OpenAPI spec' }, 400);
    }

    // Convert to tools
    const tools = endpoints.map(endpointToTool);

    // Generate files
    const serverCode = generateServerCode(serviceName, version, baseUrl, tools, endpoints, authType);
    const packageJson = generatePackageJson(serviceName, version);
    const readme = generateReadme(serviceName, version, tools);

    const result: GenerationResult = {
      success: true,
      files: [
        { name: 'server.ts', content: serverCode },
        { name: 'package.json', content: packageJson },
        { name: 'README.md', content: readme },
      ],
      manifest: {
        name: `${serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-mcp`,
        version,
        tools,
      },
    };

    return c.json(result);
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    }, 500);
  }
});

// Quick generate from URL - GET endpoint for simple testing
generateRouter.get('/from-url', async (c) => {
  const specUrl = c.req.query('url');
  const serviceName = c.req.query('name');
  
  if (!specUrl) {
    return c.json({ error: 'Missing url parameter' }, 400);
  }

  try {
    const response = await fetch(specUrl);
    if (!response.ok) {
      return c.json({ error: 'Failed to fetch OpenAPI spec' }, 400);
    }
    
    const spec = await response.json() as OpenAPISpec;
    const endpoints = parseOpenAPISpec(spec);
    const tools = endpoints.map(endpointToTool);

    return c.json({
      success: true,
      serviceName: serviceName || spec.info?.title || 'API',
      version: spec.info?.version || '1.0.0',
      endpointCount: endpoints.length,
      toolCount: tools.length,
      tools: tools.map(t => ({ name: t.name, description: t.description })),
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse spec',
    }, 500);
  }
});
