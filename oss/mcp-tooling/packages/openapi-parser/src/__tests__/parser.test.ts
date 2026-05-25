/**
 * Tests for OpenAPIParser
 */

import { OpenAPIParser, parseOpenAPI } from '../parser';
import { OpenAPIDocument, ParseResult } from '../types';

// Mock json-schema-ref-parser
jest.mock('json-schema-ref-parser', () => ({
  $RefParser: {
    dereference: jest.fn((doc: any) => Promise.resolve(doc)),
  },
}));

describe('OpenAPIParser', () => {
  let parser: OpenAPIParser;

  beforeEach(() => {
    parser = new OpenAPIParser();
  });

  describe('parse', () => {
    it('should parse valid JSON OpenAPI spec', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {},
      });

      const result = await parser.parse(spec);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document?.info.title).toBe('Test API');
      expect(result.metadata.format).toBe('json');
    });

    it('should parse valid YAML OpenAPI spec', async () => {
      const spec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
      `;

      const result = await parser.parse(spec);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document?.info.title).toBe('Test API');
      expect(result.metadata.format).toBe('yaml');
    });

    it('should reject invalid JSON and YAML', async () => {
      const invalidSpec = 'not json or yaml {{{';

      const result = await parser.parse(invalidSpec);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_FORMAT');
    });

    it('should validate OpenAPI version field', async () => {
      const spec = JSON.stringify({
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {},
      });

      const result = await parser.parse(spec);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_OPENAPI_VERSION')).toBe(true);
    });

    it('should validate info object exists', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        paths: {},
      });

      const result = await parser.parse(spec);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_INFO')).toBe(true);
    });

    it('should validate title in info object', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: {
          version: '1.0.0',
        },
        paths: {},
      });

      const result = await parser.parse(spec);

      expect(result.errors.some(e => e.code === 'MISSING_TITLE')).toBe(true);
    });

    it('should validate version in info object', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
        },
        paths: {},
      });

      const result = await parser.parse(spec);

      expect(result.errors.some(e => e.code === 'MISSING_VERSION')).toBe(true);
    });

    it('should warn about missing paths', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
      });

      const result = await parser.parse(spec);

      expect(result.warnings.some(w => w.code === 'MISSING_PATHS')).toBe(true);
    });

    it('should warn about unsupported OpenAPI versions', async () => {
      const spec = JSON.stringify({
        openapi: '2.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {},
      });

      const result = await parser.parse(spec);

      expect(result.warnings.some(w => w.code === 'UNSUPPORTED_VERSION')).toBe(true);
    });

    it('should accept valid OpenAPI 3.x versions', async () => {
      const versions = ['3.0.0', '3.0.1', '3.0.3', '3.1.0'];

      for (const version of versions) {
        const spec = JSON.stringify({
          openapi: version,
          info: {
            title: 'Test API',
            version: '1.0.0',
          },
          paths: {},
        });

        const result = await parser.parse(spec);

        expect(result.success).toBe(true);
        expect(result.warnings.some(w => w.code === 'UNSUPPORTED_VERSION')).toBe(false);
      }
    });

    it('should include metadata in result', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
          description: 'Test Description',
        },
        servers: [
          {
            url: 'https://api.example.com',
          },
        ],
        paths: {
          '/users': {
            get: {
              summary: 'List users',
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      });

      const result = await parser.parse(spec);

      expect(result.metadata.title).toBe('Test API');
      expect(result.metadata.description).toBe('Test Description');
      expect(result.metadata.version).toBe('3.0.0');
      expect(result.metadata.baseUrl).toBe('https://api.example.com');
      expect(result.metadata.endpointCount).toBe(1);
      expect(result.metadata.parsedAt).toBeInstanceOf(Date);
    });

    it('should handle parse errors gracefully', async () => {
      const invalidSpec = JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {},
      });

      // Force an error by mocking $RefParser to throw
      const { $RefParser } = require('json-schema-ref-parser');
      $RefParser.dereference.mockRejectedValueOnce(new Error('Dereference failed'));

      const result = await parser.parse(invalidSpec);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'PARSE_ERROR')).toBe(true);
    });
  });

  describe('parseFromFile', () => {
    it('should parse spec from file', async () => {
      // Mock fs/promises
      jest.mock('fs/promises', () => ({
        readFile: jest.fn().mockResolvedValue(JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {},
        })),
      }));

      const result = await parser.parseFromFile('/path/to/spec.json');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('metadata');
    });

    it('should handle file read errors', async () => {
      jest.mock('fs/promises', () => ({
        readFile: jest.fn().mockRejectedValue(new Error('File not found')),
      }));

      const result = await parser.parseFromFile('/invalid/path.json');

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'FILE_ERROR')).toBe(true);
    });
  });

  describe('parseFromUrl', () => {
    it('should parse spec from URL', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {},
        })),
      }) as jest.Mock;

      const result = await parser.parseFromUrl('https://example.com/openapi.json');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('metadata');
    });

    it('should handle HTTP errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }) as jest.Mock;

      const result = await parser.parseFromUrl('https://example.com/notfound.json');

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'URL_ERROR')).toBe(true);
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as jest.Mock;

      const result = await parser.parseFromUrl('https://example.com/spec.json');

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'URL_ERROR')).toBe(true);
    });
  });

  describe('extractEndpoints', () => {
    it('should extract GET endpoint', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              summary: 'List all users',
              description: 'Get a list of users',
              tags: ['users'],
              parameters: [],
              responses: {
                '200': { description: 'Success' },
              },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].path).toBe('/users');
      expect(endpoints[0].method).toBe('GET');
      expect(endpoints[0].operationId).toBe('listUsers');
      expect(endpoints[0].summary).toBe('List all users');
      expect(endpoints[0].tags).toEqual(['users']);
    });

    it('should extract multiple HTTP methods', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              summary: 'Get user',
              responses: { '200': { description: 'Success' } },
            },
            put: {
              summary: 'Update user',
              responses: { '200': { description: 'Success' } },
            },
            delete: {
              summary: 'Delete user',
              responses: { '204': { description: 'No Content' } },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints).toHaveLength(3);
      expect(endpoints.map(e => e.method)).toEqual(['GET', 'PUT', 'DELETE']);
    });

    it('should extract all standard HTTP methods', () => {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
      const paths: any = {
        '/test': {},
      };

      methods.forEach(method => {
        paths['/test'][method] = {
          summary: `${method} endpoint`,
          responses: { '200': { description: 'Success' } },
        };
      });

      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths,
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints).toHaveLength(8);
      expect(endpoints.map(e => e.method.toLowerCase())).toEqual(methods);
    });

    it('should extract path parameters', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                  description: 'User ID',
                },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints[0].parameters).toHaveLength(1);
      expect(endpoints[0].parameters[0].name).toBe('id');
      expect(endpoints[0].parameters[0].in).toBe('path');
      expect(endpoints[0].parameters[0].required).toBe(true);
      expect(endpoints[0].parameters[0].type).toBe('string');
    });

    it('should extract query parameters', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  required: false,
                  schema: { type: 'integer', format: 'int32' },
                  description: 'Limit results',
                  example: 10,
                },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints[0].parameters[0].name).toBe('limit');
      expect(endpoints[0].parameters[0].in).toBe('query');
      expect(endpoints[0].parameters[0].required).toBe(false);
      expect(endpoints[0].parameters[0].format).toBe('int32');
      expect(endpoints[0].parameters[0].example).toBe(10);
    });

    it('should extract request body', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            post: {
              requestBody: {
                required: true,
                description: 'User data',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints[0].requestBody).toBeDefined();
      expect(endpoints[0].requestBody?.contentType).toBe('application/json');
      expect(endpoints[0].requestBody?.required).toBe(true);
      expect(endpoints[0].requestBody?.description).toBe('User data');
    });

    it('should extract responses', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { type: 'object' },
                      },
                      example: [{ id: 1, name: 'John' }],
                    },
                  },
                },
                '404': {
                  description: 'Not Found',
                },
              },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints[0].responses).toHaveLength(2);
      expect(endpoints[0].responses[0].statusCode).toBe('200');
      expect(endpoints[0].responses[0].contentType).toBe('application/json');
      expect(endpoints[0].responses[0].example).toBeDefined();
      expect(endpoints[0].responses[1].statusCode).toBe('404');
    });

    it('should mark deprecated endpoints', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/old-endpoint': {
            get: {
              deprecated: true,
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints[0].deprecated).toBe(true);
    });

    it('should handle missing paths', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints).toHaveLength(0);
    });

    it('should default deprecated to false', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints[0].deprecated).toBe(false);
    });

    it('should default tags to empty array', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };

      const endpoints = parser.extractEndpoints(document);

      expect(endpoints[0].tags).toEqual([]);
    });
  });

  describe('extractSchemas', () => {
    it('should extract schema definitions', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
              required: ['id', 'name'],
              description: 'User model',
              example: { id: '1', name: 'John' },
            },
          },
        },
      };

      const schemas = parser.extractSchemas(document);

      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe('User');
      expect(schemas[0].type).toBe('object');
      expect(schemas[0].properties).toHaveProperty('id');
      expect(schemas[0].properties).toHaveProperty('name');
      expect(schemas[0].required).toEqual(['id', 'name']);
      expect(schemas[0].description).toBe('User model');
      expect(schemas[0].example).toBeDefined();
    });

    it('should handle missing components', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      };

      const schemas = parser.extractSchemas(document);

      expect(schemas).toHaveLength(0);
    });

    it('should handle missing schemas in components', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {},
      };

      const schemas = parser.extractSchemas(document);

      expect(schemas).toHaveLength(0);
    });

    it('should extract multiple schemas', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { id: { type: 'string' } },
            },
            Post: {
              type: 'object',
              properties: { title: { type: 'string' } },
            },
            Comment: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      };

      const schemas = parser.extractSchemas(document);

      expect(schemas).toHaveLength(3);
      expect(schemas.map(s => s.name)).toEqual(['User', 'Post', 'Comment']);
    });

    it('should default type to object if missing', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            UnknownType: {
              properties: { id: { type: 'string' } },
            },
          },
        },
      };

      const schemas = parser.extractSchemas(document);

      expect(schemas[0].type).toBe('object');
    });

    it('should default properties to empty object if missing', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            EmptySchema: {
              type: 'object',
            },
          },
        },
      };

      const schemas = parser.extractSchemas(document);

      expect(schemas[0].properties).toEqual({});
    });

    it('should default required to empty array if missing', () => {
      const document: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            OptionalFields: {
              type: 'object',
              properties: { name: { type: 'string' } },
            },
          },
        },
      };

      const schemas = parser.extractSchemas(document);

      expect(schemas[0].required).toEqual([]);
    });
  });

  describe('parseOpenAPI convenience function', () => {
    it('should parse spec using convenience function', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      });

      const result = await parseOpenAPI(spec);

      expect(result.success).toBe(true);
      expect(result.metadata.title).toBe('Test API');
    });

    it('should handle errors using convenience function', async () => {
      const invalidSpec = 'invalid';

      const result = await parseOpenAPI(invalidSpec);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
