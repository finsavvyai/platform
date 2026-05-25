import { GoMCPGenerator } from './generator';
import { ExtractedEndpoint, ExtractedSchema } from '@mcpoverflow/openapi-parser';

async function exampleUsage() {
  // Example OpenAPI endpoints
  const endpoints: ExtractedEndpoint[] = [
    {
      path: '/users/{id}',
      method: 'GET',
      operationId: 'getUser',
      summary: 'Get user by ID',
      description: 'Retrieve a user by their unique identifier',
      tags: ['users'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          type: 'string',
          description: 'User ID',
        },
      ],
      requestBody: undefined,
      responses: [
        {
          statusCode: '200',
          description: 'User object',
          contentType: 'application/json',
          schema: { type: 'object' },
        },
      ],
      security: [],
      deprecated: false,
    },
    {
      path: '/users',
      method: 'POST',
      operationId: 'createUser',
      summary: 'Create a new user',
      description: 'Create a new user with the provided data',
      tags: ['users'],
      parameters: [],
      requestBody: {
        contentType: 'application/json',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name', 'email'],
        },
        required: true,
        description: 'User data',
      },
      responses: [
        {
          statusCode: '201',
          description: 'Created user',
          contentType: 'application/json',
          schema: { type: 'object' },
        },
      ],
      security: [],
      deprecated: false,
    },
  ];

  // Example schemas
  const schemas: ExtractedSchema[] = [
    {
      name: 'User',
      type: 'object',
      properties: {
        id: { type: 'string', description: 'User ID' },
        name: { type: 'string', description: 'User name' },
        email: { type: 'string', description: 'User email' },
      },
      required: ['id', 'name', 'email'],
      description: 'User object',
    },
  ];

  // Configuration for code generation
  const config = {
    language: 'go' as const,
    packageName: 'mcpoverflow-users',
    serviceName: 'UserAPI',
    serviceVersion: '1.0.0',
    outputPath: './generated-go-server',
    author: 'MCPOverflow Team',
    description: 'MCP server for User API operations',
    license: 'MIT',
    repository: 'github.com/mcpoverflow/user-api-server',
  };

  // Generation options
  const options = {
    includeTests: true,
    includeDocs: true,
    includeExamples: true,
    validationLevel: 'basic' as const,
    outputFormat: 'multi-file' as const,
    useTinyGo: true,
  };

  // Create generator and generate code
  const generator = new GoMCPGenerator();
  const result = await generator.generate(config, options, endpoints, schemas);

  if (result.success) {
    console.log(`✅ Generated ${result.files.length} files for ${config.packageName}`);
    console.log(`📁 Output directory: ${config.outputPath}`);
    console.log(`🔧 Tools generated: ${endpoints.length}`);

    // List generated files
    result.files.forEach(file => {
      console.log(`   - ${file.path} (${file.type}, ${file.size} bytes)`);
    });
  } else {
    console.error('❌ Code generation failed:');
    result.errors.forEach(error => {
      console.error(`   ${error.code}: ${error.message}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    result.warnings.forEach(warning => {
      console.log(`   ${warning.code}: ${warning.message}`);
    });
  }
}

// Run the example
if (require.main === module) {
  exampleUsage().catch(console.error);
}

export { exampleUsage };