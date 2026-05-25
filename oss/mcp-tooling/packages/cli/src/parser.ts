/**
 * OpenAPI Parser - Parses OpenAPI 3.x specifications
 */

import $RefParser from '@apidevtools/json-schema-ref-parser';
import yaml from 'yaml';

export interface ParsedEndpoint {
  path: string;
  method: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: Record<string, ParsedResponse>;
  security: ParsedSecurity[];
  deprecated: boolean;
}

export interface ParsedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description: string;
  schema: Record<string, unknown>;
}

export interface ParsedRequestBody {
  required: boolean;
  description: string;
  content: Record<string, { schema: Record<string, unknown> }>;
}

export interface ParsedResponse {
  description: string;
  content?: Record<string, { schema: Record<string, unknown> }>;
}

export interface ParsedSecurity {
  type: string;
  scheme?: string;
  name?: string;
  in?: string;
}

export interface ParsedSchema {
  name: string;
  type: string;
  properties: Record<string, unknown>;
  required: string[];
  description?: string;
}

export interface ParseError {
  code: string;
  message: string;
  path: string;
}

export interface ParseWarning {
  code: string;
  message: string;
  path: string;
}

export interface ParseMetadata {
  title: string;
  version: string;
  description: string;
  servers: { url: string; description?: string }[];
}

export interface ParseResult {
  success: boolean;
  endpoints: ParsedEndpoint[];
  schemas: ParsedSchema[];
  metadata: ParseMetadata;
  errors: ParseError[];
  warnings: ParseWarning[];
}

// OpenAPI Document type
interface OpenAPIDocument {
  openapi: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  servers?: { url: string; description?: string }[];
  paths?: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  head?: Operation;
  options?: Operation;
  parameters?: Parameter[];
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  security?: SecurityRequirement[];
  deprecated?: boolean;
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
}

interface RequestBody {
  required?: boolean;
  description?: string;
  content?: Record<string, { schema?: Record<string, unknown> }>;
}

interface Response {
  description?: string;
  content?: Record<string, { schema?: Record<string, unknown> }>;
}

interface SecurityRequirement {
  [key: string]: string[];
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  name?: string;
  in?: string;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
}

export async function parseOpenAPI(spec: string): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  
  try {
    // Parse JSON or YAML
    let document: OpenAPIDocument;
    try {
      document = JSON.parse(spec) as OpenAPIDocument;
    } catch {
      try {
        document = yaml.parse(spec) as OpenAPIDocument;
      } catch {
        errors.push({
          code: 'INVALID_FORMAT',
          message: 'Invalid JSON or YAML format',
          path: '',
        });
        return { success: false, endpoints: [], schemas: [], metadata: emptyMetadata(), errors, warnings };
      }
    }
    
    // Dereference $ref pointers
    const dereferencedDoc = await $RefParser.dereference(document as unknown as $RefParser.JSONSchema, {
      continueOnError: true,
      dereference: { circular: 'ignore' },
    }) as unknown as OpenAPIDocument;
    
    // Validate OpenAPI version
    if (!dereferencedDoc.openapi?.startsWith('3.')) {
      errors.push({
        code: 'UNSUPPORTED_VERSION',
        message: `Unsupported OpenAPI version: ${dereferencedDoc.openapi || 'unknown'}. Only 3.x is supported.`,
        path: 'openapi',
      });
      return { success: false, endpoints: [], schemas: [], metadata: emptyMetadata(), errors, warnings };
    }
    
    // Extract metadata
    const metadata: ParseMetadata = {
      title: dereferencedDoc.info?.title || 'Untitled API',
      version: dereferencedDoc.info?.version || '1.0.0',
      description: dereferencedDoc.info?.description || '',
      servers: dereferencedDoc.servers || [],
    };
    
    // Extract endpoints
    const endpoints = extractEndpoints(dereferencedDoc, warnings);
    
    // Extract schemas
    const schemas = extractSchemas(dereferencedDoc);
    
    return {
      success: true,
      endpoints,
      schemas,
      metadata,
      errors,
      warnings,
    };
    
  } catch (error) {
    errors.push({
      code: 'PARSE_ERROR',
      message: (error as Error).message,
      path: '',
    });
    return { success: false, endpoints: [], schemas: [], metadata: emptyMetadata(), errors, warnings };
  }
}

function emptyMetadata(): ParseMetadata {
  return { title: '', version: '', description: '', servers: [] };
}

function extractEndpoints(doc: OpenAPIDocument, warnings: ParseWarning[]): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;
  
  if (!doc.paths) return endpoints;
  
  for (const [path, pathItem] of Object.entries(doc.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;
      
      // Generate operationId if missing
      const operationId = operation.operationId || 
        `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')}`;
      
      if (!operation.operationId) {
        warnings.push({
          code: 'MISSING_OPERATION_ID',
          message: `Missing operationId for ${method.toUpperCase()} ${path}, using generated: ${operationId}`,
          path: `paths.${path}.${method}`,
        });
      }
      
      endpoints.push({
        path,
        method: method.toUpperCase(),
        operationId,
        summary: operation.summary || '',
        description: operation.description || operation.summary || '',
        tags: operation.tags || [],
        parameters: extractParameters(operation.parameters || [], pathItem.parameters || []),
        requestBody: extractRequestBody(operation.requestBody),
        responses: extractResponses(operation.responses || {}),
        security: extractSecurity(operation.security, doc.components?.securitySchemes),
        deprecated: operation.deprecated || false,
      });
    }
  }
  
  return endpoints;
}

function extractParameters(opParams: Parameter[], pathParams: Parameter[]): ParsedParameter[] {
  const allParams = [...pathParams, ...opParams];
  return allParams.map(p => ({
    name: p.name,
    in: p.in,
    required: p.required || p.in === 'path',
    description: p.description || '',
    schema: p.schema || { type: 'string' },
  }));
}

function extractRequestBody(rb?: RequestBody): ParsedRequestBody | undefined {
  if (!rb) return undefined;
  return {
    required: rb.required || false,
    description: rb.description || '',
    content: (rb.content || {}) as Record<string, { schema: Record<string, unknown> }>,
  };
}

function extractResponses(responses: Record<string, Response>): Record<string, ParsedResponse> {
  const result: Record<string, ParsedResponse> = {};
  for (const [code, response] of Object.entries(responses)) {
    result[code] = {
      description: response.description || '',
      content: response.content as Record<string, { schema: Record<string, unknown> }> | undefined,
    };
  }
  return result;
}

function extractSecurity(opSecurity?: SecurityRequirement[], schemes?: Record<string, SecurityScheme>): ParsedSecurity[] {
  if (!opSecurity || !schemes) return [];
  
  const result: ParsedSecurity[] = [];
  for (const secReq of opSecurity) {
    for (const schemeName of Object.keys(secReq)) {
      const scheme = schemes[schemeName];
      if (scheme) {
        result.push({
          type: scheme.type,
          scheme: scheme.scheme,
          name: scheme.name,
          in: scheme.in,
        });
      }
    }
  }
  return result;
}

function extractSchemas(doc: OpenAPIDocument): ParsedSchema[] {
  const schemas: ParsedSchema[] = [];
  
  if (!doc.components?.schemas) return schemas;
  
  for (const [name, schema] of Object.entries(doc.components.schemas)) {
    schemas.push({
      name,
      type: schema.type || 'object',
      properties: (schema.properties || {}) as Record<string, unknown>,
      required: schema.required || [],
      description: schema.description,
    });
  }
  
  return schemas;
}
