/**
 * End-to-end smoke test for the OpenAPI -> MCP code generation path.
 *
 * Unlike generator.test.ts (which mocks fs/promises and template content),
 * this test exercises the REAL generation path:
 *  - TypeScript generator: inline string emission of an MCP Cloudflare Worker.
 *  - Go generator: real Handlebars rendering against templates/go on disk.
 *
 * It feeds a tiny OpenAPI-derived endpoint set and asserts real worker code
 * is emitted (no mocks).
 */

import { generateTypeScriptMCP, GoMCPGenerator } from '../index';
import { ExtractedEndpoint } from '@mcpoverflow/openapi-parser';
import * as path from 'path';

// A tiny "OpenAPI spec" already extracted into the parser's contract shape:
// GET /pets/{petId} -> getPetById
const endpoints: ExtractedEndpoint[] = [
  {
    path: '/pets/{petId}',
    method: 'GET',
    operationId: 'getPetById',
    summary: 'Find pet by ID',
    description: 'Returns a single pet',
    tags: ['pets'],
    parameters: [
      {
        name: 'petId',
        in: 'path',
        required: true,
        type: 'integer',
        description: 'ID of pet to return',
      },
    ],
    requestBody: undefined,
    responses: [
      {
        statusCode: '200',
        description: 'successful operation',
        contentType: 'application/json',
        schema: { type: 'object', properties: { id: { type: 'integer' } } },
      },
    ],
    security: [],
    deprecated: false,
  },
];

describe('E2E smoke: OpenAPI -> MCP code generation', () => {
  describe('TypeScript MCP Worker emission (inline, no mocks)', () => {
    it('emits a real MCP worker server.ts containing the tool and a fetch handler', async () => {
      const result = await generateTypeScriptMCP(
        'Petstore',
        '1.0.0',
        'https://api.petstore.example.com',
        endpoints,
        { authType: 'api_key', authHeader: 'X-API-Key' }
      );

      expect(result.errors).toHaveLength(0);
      expect(result.files.length).toBeGreaterThan(0);

      const server = result.files.find((f) => f.path === 'server.ts');
      expect(server).toBeDefined();
      // Real generated worker code: the operation must surface as an MCP tool.
      // operationId getPetById is snake_cased into the MCP tool name.
      expect(server!.content).toContain('get_pet_by_id');
      // Worker must wire the upstream API base url into the request layer.
      expect(server!.content).toContain('https://api.petstore.example.com');
      // It must import the MCP SDK and register tool handlers.
      expect(server!.content).toContain('@modelcontextprotocol/sdk');
      expect(server!.content).toContain('ListToolsRequestSchema');
      // It must be a non-trivial amount of generated code, not a stub.
      expect(server!.content.length).toBeGreaterThan(200);

      // MCP manifest must list the tool.
      const manifest = result.files.find((f) => f.path === 'mcp-manifest.json');
      expect(manifest).toBeDefined();
      const manifestText = JSON.stringify(JSON.parse(manifest!.content));
      expect(manifestText).toContain('get_pet_by_id');
    });
  });

  describe('Go MCP server emission (real Handlebars templates on disk)', () => {
    it('renders real Go source from templates/go without fs mocks', async () => {
      const templateDir = path.join(__dirname, '..', '..', 'templates', 'go');
      const generator = new GoMCPGenerator(templateDir);

      const result = await generator.generate(
        {
          language: 'go',
          packageName: 'petstore',
          serviceName: 'Petstore',
          serviceVersion: '1.0.0',
          // empty outputPath => generate in memory, do not write to disk
          outputPath: '',
        },
        {
          includeTests: false,
          includeDocs: true,
          includeExamples: false,
          validationLevel: 'basic',
          outputFormat: 'multi-file',
          useTinyGo: false,
        },
        endpoints
      );

      expect(result.errors).toHaveLength(0);
      expect(result.files.length).toBeGreaterThan(0);

      // main.go must be rendered with the package name interpolated.
      const mainGo = result.files.find((f) => f.path.endsWith('main.go'));
      expect(mainGo).toBeDefined();
      expect(mainGo!.content).toContain('package main');
      // Handlebars {{...}} placeholders must be fully resolved, not leaked.
      expect(mainGo!.content).not.toContain('{{');

      // go.mod must carry the interpolated module/package name.
      const goMod = result.files.find((f) => f.path.endsWith('go.mod'));
      expect(goMod).toBeDefined();
      expect(goMod!.content).toContain('petstore');
    });
  });
});
