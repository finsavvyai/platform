/**
 * TypeScript MCP Server Generator
 * Generates a complete MCP server from OpenAPI specifications
 */

import {
  CodegenConfig,
  GeneratorOptions,
  LanguageGenerator,
  CodeGenerationResult,
  GeneratedFile,
  CodegenError,
  CodegenWarning,
  CodegenMetadata,
  MCPTool,
  MCPParameter,
} from './types';
import { ExtractedEndpoint, ExtractedSchema } from '@mcpoverflow/openapi-parser';

interface TypeScriptGeneratorConfig extends CodegenConfig {
  baseUrl: string;
  authType?: 'none' | 'api_key' | 'bearer' | 'oauth';
  authHeader?: string;
  authEnvVar?: string;
}

export class TypeScriptMCPGenerator implements LanguageGenerator {
  
  /**
   * Generate TypeScript MCP server code from OpenAPI endpoints
   */
  async generate(
    config: CodegenConfig,
    options: GeneratorOptions,
    endpoints: ExtractedEndpoint[],
    schemas: ExtractedSchema[] = []
  ): Promise<CodeGenerationResult> {
    const errors: CodegenError[] = [];
    const warnings: CodegenWarning[] = [];
    const files: GeneratedFile[] = [];

    try {
      // Validate configuration
      const configErrors = this.validateConfig(config);
      errors.push(...configErrors);

      if (errors.length > 0) {
        return this.createResult(files, errors, warnings, config, options);
      }

      // Convert endpoints to MCP tools
      const tools = this.endpointsToTools(endpoints);

      // Generate main server file
      const serverContent = this.generateServerCode(config as TypeScriptGeneratorConfig, tools, endpoints);
      files.push({
        path: 'server.ts',
        content: serverContent,
        type: 'source',
        language: 'typescript',
        size: serverContent.length,
      });

      // Generate package.json
      const packageJson = this.generatePackageJson(config);
      files.push({
        path: 'package.json',
        content: packageJson,
        type: 'config',
        language: 'json',
        size: packageJson.length,
      });

      // Generate tsconfig.json
      const tsconfig = this.generateTsConfig();
      files.push({
        path: 'tsconfig.json',
        content: tsconfig,
        type: 'config',
        language: 'json',
        size: tsconfig.length,
      });

      // Generate README
      const readme = this.generateReadme(config, tools);
      files.push({
        path: 'README.md',
        content: readme,
        type: 'doc',
        language: 'markdown',
        size: readme.length,
      });

      // Generate MCP manifest
      const manifest = this.generateManifest(config, tools);
      files.push({
        path: 'mcp-manifest.json',
        content: manifest,
        type: 'config',
        language: 'json',
        size: manifest.length,
      });

      return this.createResult(files, errors, warnings, config, options);
    } catch (error) {
      errors.push({
        code: 'GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown generation error',
        severity: 'error',
        details: error,
      });
      return this.createResult(files, errors, warnings, config, options);
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config: CodegenConfig): CodegenError[] {
    const errors: CodegenError[] = [];

    if (!config.serviceName) {
      errors.push({
        code: 'MISSING_SERVICE_NAME',
        message: 'Service name is required',
        severity: 'error',
      });
    }

    if (!config.serviceVersion) {
      errors.push({
        code: 'MISSING_SERVICE_VERSION',
        message: 'Service version is required',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Get template files (not used for TS - inline generation)
   */
  getTemplateFiles(): string[] {
    return ['server.ts', 'package.json', 'tsconfig.json', 'README.md', 'mcp-manifest.json'];
  }

  /**
   * Get supported features
   */
  getSupportedFeatures(): string[] {
    return [
      'typescript-generation',
      'mcp-protocol',
      'stdio-transport',
      'http-transport',
      'api-key-auth',
      'bearer-auth',
      'error-handling',
      'validation',
      'cloudflare-workers',
      'local-execution',
    ];
  }

  /**
   * Convert OpenAPI endpoints to MCP tools
   */
  private endpointsToTools(endpoints: ExtractedEndpoint[]): MCPTool[] {
    return endpoints.map(endpoint => {
      const toolName = this.generateToolName(endpoint);
      const parameters = this.extractParameters(endpoint);

      return {
        name: toolName,
        description: endpoint.description || endpoint.summary || `${endpoint.method.toUpperCase()} ${endpoint.path}`,
        parameters,
        returnType: 'object',
        methodName: this.toCamelCase(toolName),
        endpoint,
      };
    });
  }

  /**
   * Generate tool name from endpoint
   */
  private generateToolName(endpoint: ExtractedEndpoint): string {
    if (endpoint.operationId) {
      return this.toSnakeCase(endpoint.operationId);
    }
    
    // Generate from method + path
    const pathParts = endpoint.path
      .split('/')
      .filter(p => p && !p.startsWith('{'))
      .map(p => p.replace(/[^a-zA-Z0-9]/g, ''));
    
    return `${endpoint.method}_${pathParts.join('_')}`.toLowerCase();
  }

  /**
   * Extract parameters from endpoint
   */
  private extractParameters(endpoint: ExtractedEndpoint): MCPParameter[] {
    const params: MCPParameter[] = [];

    // Path / query / header parameters
    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        params.push({
          name: param.name,
          type: this.mapSchemaType(param.type),
          description: param.description,
          required: param.required || false,
          schema: { type: param.type, format: param.format, example: param.example },
        });
      }
    }

    // Request body
    if (endpoint.requestBody) {
      const schema = endpoint.requestBody.schema;

      if (schema) {
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            const prop = propSchema as any;
            params.push({
              name: propName,
              type: this.mapSchemaType(prop.type),
              description: prop.description,
              required: schema.required?.includes(propName) || false,
              schema: prop,
            });
          }
        } else {
          // Single body parameter
          params.push({
            name: 'body',
            type: 'object',
            description: endpoint.requestBody.description || 'Request body',
            required: endpoint.requestBody.required || false,
            schema: schema,
          });
        }
      }
    }

    return params;
  }

  /**
   * Map OpenAPI schema type to TypeScript type
   */
  private mapSchemaType(type?: string): string {
    switch (type) {
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'object':
        return 'object';
      default:
        return 'string';
    }
  }

  /**
   * Generate the main server code
   */
  private generateServerCode(config: TypeScriptGeneratorConfig, tools: MCPTool[], endpoints: ExtractedEndpoint[]): string {
    const toolDefinitions = tools.map(tool => this.generateToolDefinition(tool)).join('\n\n');
    const toolHandlers = tools.map(tool => this.generateToolHandler(tool, config)).join('\n\n');
    const toolCases = tools.map(tool => `      case '${tool.name}':\n        return await ${tool.methodName}(args);`).join('\n');

    return `#!/usr/bin/env npx tsx
/**
 * ${config.serviceName} MCP Server
 * Generated by MCPOverflow
 * Version: ${config.serviceVersion}
 * 
 * This MCP server provides tools to interact with the ${config.serviceName} API.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Configuration
const BASE_URL = process.env.${this.toEnvVar(config.serviceName)}_BASE_URL || '${config.baseUrl || 'https://api.example.com'}';
const API_KEY = process.env.${this.toEnvVar(config.serviceName)}_API_KEY || '';

// HTTP client helper
async function apiRequest(
  method: string,
  path: string,
  params: Record<string, any> = {},
  body?: any
): Promise<any> {
  // Build URL with query params for GET requests
  let url = \`\${BASE_URL}\${path}\`;
  
  // Replace path parameters
  for (const [key, value] of Object.entries(params)) {
    if (path.includes(\`{\${key}}\`)) {
      url = url.replace(\`{\${key}}\`, encodeURIComponent(String(value)));
      delete params[key];
    }
  }
  
  // Add query params for GET/DELETE
  if (['GET', 'DELETE'].includes(method.toUpperCase()) && Object.keys(params).length > 0) {
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
    'User-Agent': '${config.serviceName}-mcp/${config.serviceVersion}',
  };

  // Add authentication
  if (API_KEY) {
    headers['${config.authHeader || 'Authorization'}'] = ${config.authType === 'bearer' ? '`Bearer ${API_KEY}`' : 'API_KEY'};
  }

  const response = await fetch(url, {
    method: method.toUpperCase(),
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
  {
    name: '${config.serviceName.toLowerCase().replace(/\s+/g, '-')}-mcp',
    version: '${config.serviceVersion}',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

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
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: \`Error: \${message}\`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('${config.serviceName} MCP server running on stdio');
}

main().catch(console.error);
`;
  }

  /**
   * Generate tool definition
   */
  private generateToolDefinition(tool: MCPTool): string {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of tool.parameters) {
      properties[param.name] = {
        type: param.type === 'array' ? 'array' : param.type === 'object' ? 'object' : param.type,
        description: param.description || `Parameter: ${param.name}`,
      };
      
      if (param.required) {
        required.push(param.name);
      }
    }

    return `  {
    name: '${tool.name}',
    description: ${JSON.stringify(tool.description)},
    inputSchema: {
      type: 'object',
      properties: ${JSON.stringify(properties, null, 6).replace(/\n/g, '\n      ')},
      required: ${JSON.stringify(required)},
    },
  }`;
  }

  /**
   * Generate tool handler function
   */
  private generateToolHandler(tool: MCPTool, config: TypeScriptGeneratorConfig): string {
    const endpoint = tool.endpoint;
    const method = endpoint.method.toUpperCase();
    const path = endpoint.path;
    
    // Determine if we need body vs params
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method) && endpoint.requestBody;
    
    return `async function ${tool.methodName}(args: Record<string, any>): Promise<any> {
  ${hasBody ? `const { body, ...params } = args;
  return await apiRequest('${method}', '${path}', params, body || args);` : 
  `return await apiRequest('${method}', '${path}', args);`}
}`;
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(config: CodegenConfig): string {
    return JSON.stringify({
      name: `${config.serviceName.toLowerCase().replace(/\s+/g, '-')}-mcp`,
      version: config.serviceVersion,
      description: `MCP server for ${config.serviceName}`,
      type: 'module',
      main: 'server.ts',
      bin: {
        [config.serviceName.toLowerCase().replace(/\s+/g, '-')]: './server.ts'
      },
      scripts: {
        start: 'npx tsx server.ts',
        build: 'tsc',
        dev: 'npx tsx --watch server.ts'
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'tsx': '^4.0.0'
      },
      engines: {
        node: '>=18.0.0'
      },
      author: config.author || 'MCPOverflow',
      license: config.license || 'MIT',
      keywords: ['mcp', 'ai', 'api', config.serviceName.toLowerCase()]
    }, null, 2);
  }

  /**
   * Generate tsconfig.json
   */
  private generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        outDir: './dist',
        declaration: true
      },
      include: ['*.ts'],
      exclude: ['node_modules', 'dist']
    }, null, 2);
  }

  /**
   * Generate README
   */
  private generateReadme(config: CodegenConfig, tools: MCPTool[]): string {
    const toolList = tools.map(t => `- \`${t.name}\`: ${t.description}`).join('\n');
    
    return `# ${config.serviceName} MCP Server

Generated by [MCPOverflow](https://mcpoverflow.com)

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Set the following environment variables:

\`\`\`bash
export ${this.toEnvVar(config.serviceName)}_BASE_URL="https://api.example.com"
export ${this.toEnvVar(config.serviceName)}_API_KEY="your-api-key"
\`\`\`

## Usage with Claude Desktop

Add to your Claude Desktop config (\`~/.config/claude/claude_desktop_config.json\`):

\`\`\`json
{
  "mcpServers": {
    "${config.serviceName.toLowerCase().replace(/\s+/g, '-')}": {
      "command": "npx",
      "args": ["tsx", "/path/to/${config.serviceName.toLowerCase().replace(/\s+/g, '-')}-mcp/server.ts"],
      "env": {
        "${this.toEnvVar(config.serviceName)}_API_KEY": "your-api-key"
      }
    }
  }
}
\`\`\`

## Available Tools

${toolList}

## Running Standalone

\`\`\`bash
npm start
\`\`\`

## License

${config.license || 'MIT'}
`;
  }

  /**
   * Generate MCP manifest
   */
  private generateManifest(config: CodegenConfig, tools: MCPTool[]): string {
    return JSON.stringify({
      name: `${config.serviceName.toLowerCase().replace(/\s+/g, '-')}-mcp`,
      version: config.serviceVersion,
      description: `MCP server for ${config.serviceName}`,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: 'object',
          properties: Object.fromEntries(
            t.parameters.map(p => [p.name, { type: p.type, description: p.description }])
          ),
          required: t.parameters.filter(p => p.required).map(p => p.name)
        }
      })),
      transport: ['stdio'],
      author: config.author || 'MCPOverflow',
      repository: config.repository,
      license: config.license || 'MIT'
    }, null, 2);
  }

  /**
   * Create result object
   */
  private createResult(
    files: GeneratedFile[],
    errors: CodegenError[],
    warnings: CodegenWarning[],
    config: CodegenConfig,
    options: GeneratorOptions
  ): CodeGenerationResult {
    const metadata: CodegenMetadata = {
      language: 'typescript',
      package: config.packageName || config.serviceName,
      version: config.serviceVersion,
      fileCount: files.length,
      lineCount: files.reduce((sum, f) => sum + f.content.split('\n').length, 0),
      generatedAt: new Date(),
      config,
      options,
    };

    return {
      success: errors.length === 0,
      files,
      errors,
      warnings,
      metadata,
    };
  }

  // Helper methods
  private toPascalCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
      .replace(/[\s\-_]+/g, '');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/\W+/g, '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/^_+|_+$/g, '');
  }

  private toEnvVar(str: string): string {
    return str
      .replace(/\W+/g, '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
  }
}

/**
 * Quick generation function for simple use cases
 */
export async function generateTypeScriptMCP(
  serviceName: string,
  serviceVersion: string,
  baseUrl: string,
  endpoints: ExtractedEndpoint[],
  options: {
    authType?: 'none' | 'api_key' | 'bearer' | 'oauth';
    authHeader?: string;
  } = {}
): Promise<CodeGenerationResult> {
  const generator = new TypeScriptMCPGenerator();
  
  const config: TypeScriptGeneratorConfig = {
    language: 'typescript',
    packageName: serviceName.toLowerCase().replace(/\s+/g, '-'),
    serviceName,
    serviceVersion,
    outputPath: '',
    baseUrl,
    authType: options.authType || 'api_key',
    authHeader: options.authHeader || 'Authorization',
  };

  return generator.generate(config, {}, endpoints);
}
