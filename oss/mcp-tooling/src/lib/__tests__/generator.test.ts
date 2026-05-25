/**
 * Tests for OpenAPI Parser and Worker Code Generator
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { OpenAPIParser, parseOpenAPISpec, generateWorkerCode } from '../generator'
import type { MCPManifest, MCPTool } from '../../types/database'

describe('OpenAPIParser', () => {
  describe('constructor and initialization', () => {
    it('should initialize with valid OpenAPI spec', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {},
      }

      const parser = new OpenAPIParser(spec)
      expect(parser).toBeInstanceOf(OpenAPIParser)
    })

    it('should set default exclude patterns', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }

      const parser = new OpenAPIParser(spec)
      expect(parser.shouldExcludePath('/health')).toBe(true)
      expect(parser.shouldExcludePath('/metrics')).toBe(true)
      expect(parser.shouldExcludePath('/internal')).toBe(true)
      expect(parser.shouldExcludePath('/admin')).toBe(true)
    })

    it('should accept custom exclude patterns', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }

      const parser = new OpenAPIParser(spec, ['/private', '/test'])
      expect(parser.shouldExcludePath('/private')).toBe(true)
      expect(parser.shouldExcludePath('/test')).toBe(true)
    })
  })

  describe('shouldExcludePath', () => {
    let parser: OpenAPIParser

    beforeEach(() => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }
      parser = new OpenAPIParser(spec)
    })

    it('should exclude health endpoints', () => {
      expect(parser.shouldExcludePath('/health')).toBe(true)
      expect(parser.shouldExcludePath('/api/health')).toBe(true)
      expect(parser.shouldExcludePath('/v1/health')).toBe(true)
    })

    it('should exclude metrics endpoints', () => {
      expect(parser.shouldExcludePath('/metrics')).toBe(true)
      expect(parser.shouldExcludePath('/api/metrics')).toBe(true)
    })

    it('should exclude internal endpoints', () => {
      expect(parser.shouldExcludePath('/internal/users')).toBe(true)
      expect(parser.shouldExcludePath('/api/internal/config')).toBe(true)
    })

    it('should exclude admin endpoints', () => {
      expect(parser.shouldExcludePath('/admin/users')).toBe(true)
      expect(parser.shouldExcludePath('/api/admin/settings')).toBe(true)
    })

    it('should include regular endpoints', () => {
      expect(parser.shouldExcludePath('/users')).toBe(false)
      expect(parser.shouldExcludePath('/api/pets')).toBe(false)
      expect(parser.shouldExcludePath('/v1/products')).toBe(false)
    })
  })

  describe('detectAuthMode', () => {
    it('should detect API key authentication', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          securitySchemes: {
            ApiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      expect(parser.detectAuthMode()).toBe('api_key')
    })

    it('should detect API key by scheme name', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          securitySchemes: {
            apikey: {
              type: 'http',
              scheme: 'apikey',
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      expect(parser.detectAuthMode()).toBe('api_key')
    })

    it('should detect OAuth2 authentication', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          securitySchemes: {
            OAuth2: {
              type: 'oauth2',
              flows: {
                authorizationCode: {
                  authorizationUrl: 'https://example.com/oauth/authorize',
                  tokenUrl: 'https://example.com/oauth/token',
                  scopes: {
                    read: 'Read access',
                    write: 'Write access',
                  },
                },
              },
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      expect(parser.detectAuthMode()).toBe('oauth_client')
    })

    it('should detect JWT bearer authentication', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      expect(parser.detectAuthMode()).toBe('jwt')
    })

    it('should return "none" when no security schemes', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }

      const parser = new OpenAPIParser(spec)
      expect(parser.detectAuthMode()).toBe('none')
    })

    it('should return "none" when components is undefined', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: undefined,
      }

      const parser = new OpenAPIParser(spec)
      expect(parser.detectAuthMode()).toBe('none')
    })

    it('should prioritize api_key over other auth types', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          securitySchemes: {
            ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
            Bearer: { type: 'http', scheme: 'bearer' },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      expect(parser.detectAuthMode()).toBe('api_key')
    })
  })

  describe('buildInputSchema', () => {
    let parser: OpenAPIParser

    beforeEach(() => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }
      parser = new OpenAPIParser(spec)
    })

    it('should build schema from path parameters', () => {
      const parameters = [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'User ID',
        },
        {
          name: 'filter',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Filter query',
        },
      ]

      const schema = parser.buildInputSchema(parameters)

      expect(schema.type).toBe('object')
      expect(schema.properties).toHaveProperty('id')
      expect(schema.properties.id.type).toBe('string')
      expect(schema.properties.id.description).toBe('User ID')
      expect(schema.required).toContain('id')
      expect(schema.required).not.toContain('filter')
    })

    it('should include request body in schema', () => {
      const requestBody = {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
              },
            },
          },
        },
      }

      const schema = parser.buildInputSchema([], requestBody)

      expect(schema.properties).toHaveProperty('body')
      expect(schema.required).toContain('body')
    })

    it('should combine parameters and request body', () => {
      const parameters = [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ]

      const requestBody = {
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
      }

      const schema = parser.buildInputSchema(parameters, requestBody)

      expect(schema.properties).toHaveProperty('id')
      expect(schema.properties).toHaveProperty('body')
      expect(schema.required).toContain('id')
      expect(schema.required).toContain('body')
    })

    it('should handle missing parameters', () => {
      const schema = parser.buildInputSchema()

      expect(schema.type).toBe('object')
      expect(schema.properties).toEqual({})
      expect(schema.required).toBeUndefined()
    })

    it('should default to string type if schema type is missing', () => {
      const parameters = [
        {
          name: 'unknown',
          in: 'query',
          required: false,
        },
      ]

      const schema = parser.buildInputSchema(parameters)

      expect(schema.properties.unknown.type).toBe('string')
    })

    it('should preserve schema details', () => {
      const parameters = [
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      ]

      const schema = parser.buildInputSchema(parameters)

      expect(schema.properties.limit.type).toBe('integer')
      expect(schema.properties.limit.minimum).toBe(1)
      expect(schema.properties.limit.maximum).toBe(100)
      expect(schema.properties.limit.default).toBe(20)
    })
  })

  describe('buildOutputSchema', () => {
    let parser: OpenAPIParser

    beforeEach(() => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }
      parser = new OpenAPIParser(spec)
    })

    it('should extract 200 response schema', () => {
      const responses = {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      }

      const schema = parser.buildOutputSchema(responses)

      expect(schema.type).toBe('object')
      expect(schema.properties).toHaveProperty('id')
      expect(schema.properties).toHaveProperty('name')
    })

    it('should extract 201 response schema when 200 is not present', () => {
      const responses = {
        '201': {
          description: 'Created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
              },
            },
          },
        },
      }

      const schema = parser.buildOutputSchema(responses)

      expect(schema.type).toBe('object')
      expect(schema.properties).toHaveProperty('id')
    })

    it('should return default schema when no success response', () => {
      const responses = {
        '400': {
          description: 'Bad Request',
        },
      }

      const schema = parser.buildOutputSchema(responses)

      expect(schema.type).toBe('object')
      expect(schema.properties).toBeUndefined()
    })

    it('should handle missing responses', () => {
      const schema = parser.buildOutputSchema(undefined)

      expect(schema.type).toBe('object')
    })

    it('should handle missing content', () => {
      const responses = {
        '200': {
          description: 'Success',
        },
      }

      const schema = parser.buildOutputSchema(responses)

      expect(schema.type).toBe('object')
    })
  })

  describe('flattenSchema', () => {
    let parser: OpenAPIParser

    beforeEach(() => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      }
      parser = new OpenAPIParser(spec)
    })

    it('should flatten object schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }

      const flattened = parser.flattenSchema(schema, 3)

      expect(flattened.type).toBe('object')
      expect(flattened.properties.name.type).toBe('string')
      expect(flattened.properties.age.type).toBe('number')
      expect(flattened.required).toEqual(['name'])
    })

    it('should flatten nested objects up to maxDepth', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  bio: { type: 'string' },
                },
              },
            },
          },
        },
      }

      const flattened = parser.flattenSchema(schema, 3)

      expect(flattened.type).toBe('object')
      expect(flattened.properties.user.type).toBe('object')
      expect(flattened.properties.user.properties.profile.type).toBe('object')
      // At depth 3, bio should still be flattened as it's within the maxDepth
      expect(flattened.properties.user.properties.profile.properties).toBeDefined()
    })

    it('should stop flattening at maxDepth', () => {
      const deepSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      level4: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const flattened = parser.flattenSchema(deepSchema, 2)

      expect(flattened.type).toBe('object')
      expect(flattened.properties.level1.type).toBe('object')
      expect(flattened.properties.level1.properties.level2.type).toBe('object')
      // At maxDepth=2, recursion stops at level2 — no nested properties emitted.
      expect(flattened.properties.level1.properties.level2.properties).toBeUndefined()
    })

    it('should handle $ref with description', () => {
      const schema = {
        $ref: '#/components/schemas/User',
      }

      const flattened = parser.flattenSchema(schema, 3)

      expect(flattened.type).toBe('object')
      expect(flattened.description).toContain('Reference:')
      expect(flattened.description).toContain('User')
    })

    it('should handle allOf/oneOf/anyOf schemas', () => {
      const schemas = [
        { allOf: [{ type: 'object' }, { type: 'object' }] },
        { oneOf: [{ type: 'string' }, { type: 'number' }] },
        { anyOf: [{ type: 'string' }, { type: 'number' }] },
      ]

      schemas.forEach(schema => {
        const flattened = parser.flattenSchema(schema, 3)
        expect(flattened.type).toBe('object')
        expect(flattened.description).toContain('Complex schema')
      })
    })

    it('should flatten array schemas', () => {
      const schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      }

      const flattened = parser.flattenSchema(schema, 3)

      expect(flattened.type).toBe('array')
      expect(flattened.items.type).toBe('object')
      expect(flattened.items.properties.id.type).toBe('string')
    })

    it('should return default for null schema', () => {
      const flattened = parser.flattenSchema(null, 3)

      expect(flattened.type).toBe('object')
    })

    it('should preserve primitive schemas', () => {
      const primitives = [
        { type: 'string', minLength: 5 },
        { type: 'number', minimum: 0 },
        { type: 'boolean' },
        { type: 'integer', maximum: 100 },
      ]

      primitives.forEach(schema => {
        const flattened = parser.flattenSchema(schema, 3)
        expect(flattened).toEqual(schema)
      })
    })
  })

  describe('parseToTools', () => {
    it('should convert GET endpoint to MCP tool', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'listUsers',
              summary: 'List all users',
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  schema: { type: 'integer' },
                },
              ],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      const tools = parser.parseToTools()

      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBeTruthy()
      expect(tools[0].description).toBe('List all users')
      expect(tools[0].inputSchema.properties).toHaveProperty('limit')
      expect(tools[0].outputSchema.type).toBe('array')
    })

    it('should convert POST endpoint with request body', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            post: {
              operationId: 'createUser',
              summary: 'Create a user',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        email: { type: 'string' },
                      },
                      required: ['name', 'email'],
                    },
                  },
                },
              },
              responses: {
                '201': {
                  description: 'Created',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      const tools = parser.parseToTools()

      expect(tools).toHaveLength(1)
      expect(tools[0].inputSchema.properties).toHaveProperty('body')
      expect(tools[0].inputSchema.required).toContain('body')
    })

    it('should convert multiple HTTP methods on same path', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }],
              responses: { '200': { description: 'OK' } },
            },
            put: {
              operationId: 'updateUser',
              parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }],
              responses: { '200': { description: 'OK' } },
            },
            delete: {
              operationId: 'deleteUser',
              parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }],
              responses: { '204': { description: 'No Content' } },
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      const tools = parser.parseToTools()

      expect(tools).toHaveLength(3)
    })

    it('should exclude health and admin endpoints', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: { responses: { '200': { description: 'OK' } } },
          },
          '/health': {
            get: { responses: { '200': { description: 'OK' } } },
          },
          '/metrics': {
            get: { responses: { '200': { description: 'OK' } } },
          },
          '/admin/settings': {
            get: { responses: { '200': { description: 'OK' } } },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      const tools = parser.parseToTools()

      expect(tools).toHaveLength(1)
      expect(tools[0].description).toContain('/users')
    })

    it('should use summary or description for tool description', () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/with-summary': {
            get: {
              summary: 'Test summary',
              responses: { '200': { description: 'OK' } },
            },
          },
          '/with-description': {
            get: {
              description: 'Test description',
              responses: { '200': { description: 'OK' } },
            },
          },
          '/with-both': {
            get: {
              summary: 'Test summary',
              description: 'Test description',
              responses: { '200': { description: 'OK' } },
            },
          },
          '/with-neither': {
            get: {
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      const tools = parser.parseToTools()

      expect(tools[0].description).toBe('Test summary')
      expect(tools[1].description).toBe('Test description')
      expect(tools[2].description).toBe('Test summary') // Summary takes priority
      expect(tools[3].description).toContain('GET') // Fallback
    })
  })

  describe('generateManifest', () => {
    it('should generate complete MCP manifest', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Petstore API',
          version: '1.0.0',
          description: 'A simple pet store API',
        },
        paths: {
          '/pets': {
            get: {
              operationId: 'listPets',
              summary: 'List all pets',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      const manifest = parser.generateManifest()

      expect(manifest.name).toBe('petstore-api')
      expect(manifest.version).toBe('1.0.0')
      expect(manifest.description).toBe('A simple pet store API')
      expect(manifest.tools).toHaveLength(1)
      expect(manifest.tools[0].name).toBeTruthy()
    })

    it('should normalize manifest name', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'My Awesome API Service',
          version: '2.0.0',
        },
        paths: {},
      }

      const parser = new OpenAPIParser(spec)
      const manifest = parser.generateManifest()

      expect(manifest.name).toBe('my-awesome-api-service')
    })
  })

  describe('getSpecSummary', () => {
    it('should return spec summary information', () => {
      const spec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            get: { responses: { '200': { description: 'OK' } } },
            post: { responses: { '201': { description: 'Created' } } },
          },
          '/posts': {
            get: { responses: { '200': { description: 'OK' } } },
          },
        },
        components: {
          securitySchemes: {
            ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
          },
        },
      }

      const parser = new OpenAPIParser(spec)
      const summary = parser.getSpecSummary()

      expect(summary.title).toBe('Test API')
      expect(summary.version).toBe('1.0.0')
      expect(summary.endpoints).toBe(3)
      expect(summary.authMode).toBe('api_key')
    })
  })
})

describe('parseOpenAPISpec', () => {
  it('should parse valid JSON spec', () => {
    const specContent = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
    })

    const parser = parseOpenAPISpec(specContent)
    expect(parser).toBeInstanceOf(OpenAPIParser)
  })

  it('should throw error for invalid JSON', () => {
    const invalidSpec = 'not valid json'

    expect(() => parseOpenAPISpec(invalidSpec)).toThrow('Failed to parse OpenAPI spec')
  })

  it('should pass exclude patterns to parser', () => {
    const specContent = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
    })

    const parser = parseOpenAPISpec(specContent, ['/custom'])
    expect(parser.shouldExcludePath('/custom')).toBe(true)
  })
})

describe('generateWorkerCode', () => {
  let manifest: MCPManifest

  beforeEach(() => {
    manifest = {
      name: 'test-api',
      version: '1.0.0',
      description: 'Test API',
      tools: [
        {
          name: 'listUsers',
          description: 'List all users',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'integer' },
            },
          },
          outputSchema: {
            type: 'array',
            items: { type: 'object' },
          },
        },
        {
          name: 'createUser',
          description: 'Create a user',
          inputSchema: {
            type: 'object',
            properties: {
              body: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
          outputSchema: { type: 'object' },
        },
      ],
    }
  })

  it('should generate worker code with API key auth', () => {
    const code = generateWorkerCode(manifest, 'api_key')

    expect(code).toContain('interface Env')
    expect(code).toContain('API_KEY: string')
    expect(code).toContain("headers['Authorization'] = `Bearer ${env.API_KEY}`")
    expect(code).toContain('function listUsers')
    expect(code).toContain('function createUser')
  })

  it('should generate worker code with JWT auth', () => {
    const code = generateWorkerCode(manifest, 'jwt')

    expect(code).toContain('JWT_TOKEN: string')
    expect(code).toContain("headers['Authorization'] = `Bearer ${env.JWT_TOKEN}`")
  })

  it('should generate worker code with OAuth auth', () => {
    const code = generateWorkerCode(manifest, 'oauth_client')

    expect(code).toContain('OAUTH_CLIENT_ID: string')
    expect(code).toContain('OAUTH_CLIENT_SECRET: string')
  })

  it('should generate worker code with no auth', () => {
    const code = generateWorkerCode(manifest, 'none')

    expect(code).not.toContain('API_KEY')
    expect(code).not.toContain('JWT_TOKEN')
    expect(code).not.toContain('OAUTH')
    expect(code).toContain('API_BASE: string')
  })

  it('should include CORS headers', () => {
    const code = generateWorkerCode(manifest, 'none')

    expect(code).toContain('corsHeaders')
    expect(code).toContain('Access-Control-Allow-Origin')
    expect(code).toContain('Access-Control-Allow-Methods')
    expect(code).toContain('Access-Control-Allow-Headers')
  })

  it('should handle OPTIONS requests', () => {
    const code = generateWorkerCode(manifest, 'none')

    expect(code).toContain('if (req.method === "OPTIONS")')
    expect(code).toContain('return new Response(null, { status: 200')
  })

  it('should create tool handlers for all tools', () => {
    const code = generateWorkerCode(manifest, 'none')

    expect(code).toContain('async function listUsers')
    expect(code).toContain('async function createUser')
    expect(code).toContain("'listUsers': listUsers")
    expect(code).toContain("'createUser': createUser")
  })

  it('should include error handling', () => {
    const code = generateWorkerCode(manifest, 'none')

    expect(code).toContain('try {')
    expect(code).toContain('catch (error)')
    expect(code).toContain('throw new Error')
  })

  it('should handle tool not found', () => {
    const code = generateWorkerCode(manifest, 'none')

    expect(code).toContain('if (!handler)')
    expect(code).toContain("error: 'Tool not found'")
    expect(code).toContain('status: 404')
  })

  it('should use Deno.serve', () => {
    const code = generateWorkerCode(manifest, 'none')

    expect(code).toContain('Deno.serve')
    expect(code).toContain('async (req: Request)')
  })

  it('should import Supabase edge runtime types', () => {
    const code = generateWorkerCode(manifest, 'none')

    expect(code).toContain('import "jsr:@supabase/functions-js/edge-runtime.d.ts"')
  })

  it('should handle empty tools array', () => {
    const emptyManifest: MCPManifest = {
      name: 'empty-api',
      version: '1.0.0',
      tools: [],
    }

    const code = generateWorkerCode(emptyManifest, 'none')

    expect(code).toContain('interface Env')
    expect(code).toContain('const toolMap')
    expect(code).toBeTruthy()
  })
})
