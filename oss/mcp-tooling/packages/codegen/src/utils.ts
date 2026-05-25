import { TemplateContext, MCPTool, MCPSchema } from './types';
import { ExtractedEndpoint, ExtractedSchema } from '@mcpoverflow/openapi-parser';

/**
 * Convert a string to PascalCase (FirstLetterOfEachWord)
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toUpperCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
}

/**
 * Convert a string to camelCase (firstWordLowercase, restPascalCase)
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert a string to snake_case (lowercase_with_underscores)
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map(word => word.toLowerCase())
    .join('_');
}

/**
 * Convert a string to kebab-case (lowercase-with-dashes)
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map(word => word.toLowerCase())
    .join('-');
}

/**
 * Simple pluralization for common patterns
 */
export function pluralize(str: string): string {
  if (str.endsWith('y')) {
    return str.slice(0, -1) + 'ies';
  }
  if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
    return str + 'es';
  }
  return str + 's';
}

/**
 * Simple singularization for common patterns
 */
export function singularize(str: string): string {
  if (str.endsWith('ies')) {
    return str.slice(0, -3) + 'y';
  }
  if (str.endsWith('es') && !str.endsWith('ses')) {
    return str.slice(0, -2);
  }
  if (str.endsWith('s') && !str.endsWith('ss')) {
    return str.slice(0, -1);
  }
  return str;
}

/**
 * Format date to ISO string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Escape string for use in generated code
 */
export function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Convert OpenAPI endpoint to MCP tool
 */
export function endpointToMCPTool(endpoint: ExtractedEndpoint): MCPTool {
  const methodName = `${endpoint.method.toLowerCase()}${toPascalCase(endpoint.path.replace(/[^a-zA-Z0-9]/g, ''))}`;

  return {
    name: endpoint.operationId || methodName,
    description: endpoint.summary || endpoint.description || `${endpoint.method} ${endpoint.path}`,
    parameters: extractParameters(endpoint),
    returnType: inferReturnType(endpoint),
    methodName,
    endpoint
  };
}

/**
 * Extract parameters from endpoint for MCP tool
 */
function extractParameters(endpoint: ExtractedEndpoint) {
  const parameters: any[] = [];

  // Add path parameters
  endpoint.parameters
    .filter(param => param.in === 'path')
    .forEach(param => {
      parameters.push({
        name: param.name,
        type: mapOpenAPITypeToMCPType(param.type),
        description: param.description,
        required: param.required,
        schema: param.schema,
        validation: createValidationRules(param)
      });
    });

  // Add query parameters
  endpoint.parameters
    .filter(param => param.in === 'query')
    .forEach(param => {
      parameters.push({
        name: param.name,
        type: mapOpenAPITypeToMCPType(param.type),
        description: param.description,
        required: param.required,
        schema: param.schema,
        validation: createValidationRules(param)
      });
    });

  // Add request body if present
  if (endpoint.requestBody) {
    parameters.push({
      name: 'body',
      type: mapOpenAPITypeToMCPType(endpoint.requestBody.schema?.type || 'object'),
      description: endpoint.requestBody.description || 'Request body',
      required: endpoint.requestBody.required,
      schema: endpoint.requestBody.schema,
      validation: []
    });
  }

  return parameters;
}

/**
 * Map OpenAPI type to MCP type
 */
function mapOpenAPITypeToMCPType(openApiType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'string',
    'integer': 'integer',
    'number': 'number',
    'boolean': 'boolean',
    'array': 'array',
    'object': 'object'
  };

  return typeMap[openApiType] || 'string';
}

/**
 * Infer return type from endpoint responses
 */
function inferReturnType(endpoint: ExtractedEndpoint): string {
  if (endpoint.responses.length === 0) {
    return 'void';
  }

  // Find successful response (2xx)
  const successResponse = endpoint.responses.find(res =>
    res.statusCode.startsWith('2')
  );

  if (successResponse && successResponse.schema) {
    return mapOpenAPITypeToMCPType(successResponse.schema.type || 'object');
  }

  return 'object';
}

/**
 * Create validation rules for parameters
 */
function createValidationRules(param: any): any[] {
  const rules: any[] = [];

  if (param.required) {
    rules.push({
      type: 'required',
      message: `${param.name} is required`
    });
  }

  // Add more validation rules based on schema
  if (param.schema) {
    if (param.schema.minLength !== undefined) {
      rules.push({
        type: 'min',
        value: param.schema.minLength,
        message: `${param.name} must be at least ${param.schema.minLength} characters`
      });
    }

    if (param.schema.maxLength !== undefined) {
      rules.push({
        type: 'max',
        value: param.schema.maxLength,
        message: `${param.name} must be at most ${param.schema.maxLength} characters`
      });
    }

    if (param.schema.pattern) {
      rules.push({
        type: 'pattern',
        value: param.schema.pattern,
        message: `${param.name} must match pattern ${param.schema.pattern}`
      });
    }

    if (param.schema.enum) {
      rules.push({
        type: 'enum',
        value: param.schema.enum,
        message: `${param.name} must be one of: ${param.schema.enum.join(', ')}`
      });
    }
  }

  return rules;
}

/**
 * Convert OpenAPI schema to MCP schema
 */
export function schemaToMCPSchema(schema: ExtractedSchema): MCPSchema {
  const properties: Record<string, any> = {};

  Object.entries(schema.properties).forEach(([key, prop]) => {
    properties[key] = {
      type: mapOpenAPITypeToMCPType(prop.type || 'string'),
      description: prop.description,
      required: schema.required.includes(key),
      validation: createValidationRules(prop),
      defaultValue: prop.default
    };
  });

  return {
    name: schema.name,
    type: schema.type,
    properties,
    required: schema.required,
    description: schema.description
  };
}

/**
 * Create template context for Handlebars
 */
export function createTemplateContext(
  config: any,
  options: any,
  endpoints: ExtractedEndpoint[],
  schemas: ExtractedSchema[]
): TemplateContext {
  const tools = endpoints.map(endpointToMCPTool);
  const mcpSchemas = schemas.map(schemaToMCPSchema);

  return {
    config,
    options,
    tools,
    schemas: mcpSchemas,
    endpoints,
    utilities: {
      toPascalCase,
      toCamelCase,
      toSnakeCase,
      toKebabCase,
      pluralize,
      singularize,
      formatDate,
      escapeString
    }
  };
}

/**
 * Validate Go package name
 */
export function validateGoPackageName(name: string): boolean {
  return /^[a-z][a-z0-9]*$/.test(name);
}

/**
 * Generate Go import path
 */
export function generateGoImportPath(packageName: string, repository?: string): string {
  if (repository) {
    return `${repository}/${packageName}`;
  }
  return `github.com/mcpoverflow/${packageName}`;
}

/**
 * Calculate file statistics
 */
export function calculateFileStats(content: string): { lines: number; size: number } {
  const lines = content.split('\n').length;
  const size = Buffer.byteLength(content, 'utf8');
  return { lines, size };
}