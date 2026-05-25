/* eslint-disable @typescript-eslint/no-explicit-any */
// Restored from deleted code (commit 188052a1). Permissive `any` typing
// mirrors OpenAPI spec shape (untyped JSON). Retype in a follow-up pass.
export function flattenSchema(schema: any, maxDepth: number, currentDepth = 0): any {
  if (!schema || currentDepth >= maxDepth) {
    return { type: 'object' };
  }

  if (schema.$ref) {
    return { type: 'object', description: `Reference: ${schema.$ref}` };
  }

  if (schema.allOf || schema.oneOf || schema.anyOf) {
    return { type: 'object', description: 'Complex schema (union/intersection)' };
  }

  if (schema.type === 'object' && schema.properties) {
    const properties: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      properties[key] = flattenSchema(value, maxDepth, currentDepth + 1);
    }
    return {
      type: 'object',
      properties,
      ...(schema.required ? { required: schema.required } : {}),
    };
  }

  if (schema.type === 'array' && schema.items) {
    return {
      type: 'array',
      items: flattenSchema(schema.items, maxDepth, currentDepth + 1),
    };
  }

  return schema;
}

export function buildInputSchema(parameters: any[] = [], requestBody?: any): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (parameters) {
    for (const param of parameters) {
      const paramName = param.name;
      properties[paramName] = {
        type: param.schema?.type || 'string',
        description: param.description || '',
        ...(param.schema || {}),
      };

      if (param.required) {
        required.push(paramName);
      }
    }
  }

  if (requestBody?.content?.['application/json']?.schema) {
    const bodySchema = requestBody.content['application/json'].schema;
    properties.body = flattenSchema(bodySchema, 3);
    required.push('body');
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function buildOutputSchema(responses: any): any {
  const successResponse = responses?.['200'] || responses?.['201'];

  if (successResponse?.content?.['application/json']?.schema) {
    return flattenSchema(successResponse.content['application/json'].schema, 3);
  }

  return { type: 'object' };
}
