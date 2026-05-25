/* eslint-disable @typescript-eslint/no-explicit-any */
// Restored from deleted code (commit 188052a1). Permissive `any` typing
// mirrors OpenAPI spec shape (untyped JSON). Retype in a follow-up pass.
import { MCPTool, MCPManifest, AuthMode } from '../types/database';
import { deriveToolName } from '../utils/slugify';
import { buildInputSchema, buildOutputSchema, flattenSchema } from './generator-schema';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, any>;
  components?: {
    securitySchemes?: Record<string, any>;
  };
}

export class OpenAPIParser {
  private spec: OpenAPISpec;
  private excludePatterns: string[];

  constructor(spec: OpenAPISpec, excludePatterns: string[] = []) {
    this.spec = spec;
    this.excludePatterns = [
      '/health',
      '/metrics',
      '/internal',
      '/admin',
      ...excludePatterns,
    ];
  }

  shouldExcludePath(path: string): boolean {
    return this.excludePatterns.some(pattern => path.includes(pattern));
  }

  detectAuthMode(): AuthMode {
    const securitySchemes = this.spec.components?.securitySchemes || {};

    for (const [key, scheme] of Object.entries(securitySchemes)) {
      if (typeof scheme === 'object' && scheme !== null) {
        const schemeType = (scheme as any).type?.toLowerCase();

        if (schemeType === 'apikey' || key.toLowerCase().includes('apikey')) {
          return 'api_key';
        }
        if (schemeType === 'oauth2') {
          return 'oauth_client';
        }
        if (schemeType === 'http' && (scheme as any).scheme === 'bearer') {
          return 'jwt';
        }
      }
    }

    return 'none';
  }

  buildInputSchema(parameters: any[] = [], requestBody?: any): any {
    return buildInputSchema(parameters, requestBody);
  }

  buildOutputSchema(responses: any): any {
    return buildOutputSchema(responses);
  }

  flattenSchema(schema: any, maxDepth: number, currentDepth = 0): any {
    return flattenSchema(schema, maxDepth, currentDepth);
  }

  parseToTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      if (this.shouldExcludePath(path)) {
        continue;
      }

      for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
        const operation = pathItem[method];
        if (!operation) continue;

        const name = deriveToolName(
          operation.operationId,
          method,
          path,
          operation.tags
        );

        const description =
          operation.summary ||
          operation.description ||
          `${method.toUpperCase()} ${path}`;

        tools.push({
          name,
          description,
          inputSchema: buildInputSchema(operation.parameters, operation.requestBody),
          outputSchema: buildOutputSchema(operation.responses),
        });
      }
    }

    return tools;
  }

  generateManifest(): MCPManifest {
    return {
      name: this.spec.info.title.toLowerCase().replace(/\s+/g, '-'),
      version: this.spec.info.version,
      description: this.spec.info.description,
      tools: this.parseToTools(),
    };
  }

  getSpecSummary() {
    return {
      title: this.spec.info.title,
      version: this.spec.info.version,
      endpoints: this.parseToTools().length,
      authMode: this.detectAuthMode(),
    };
  }
}

export function parseOpenAPISpec(specContent: string, excludePatterns?: string[]) {
  try {
    const spec = JSON.parse(specContent) as OpenAPISpec;
    return new OpenAPIParser(spec, excludePatterns);
  } catch (error) {
    throw new Error(`Failed to parse OpenAPI spec: ${(error as Error).message}`);
  }
}
