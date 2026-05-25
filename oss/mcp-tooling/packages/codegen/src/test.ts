import { GoMCPGenerator } from './generator';
import { ExtractedEndpoint } from '@mcpoverflow/openapi-parser';

async function testCodeGeneration() {
  console.log('🧪 Testing MCP code generation engine...');

  // Minimal test endpoint
  const testEndpoint: ExtractedEndpoint = {
    path: '/test/{id}',
    method: 'GET',
    operationId: 'testEndpoint',
    summary: 'Test endpoint',
    description: 'A simple test endpoint',
    tags: ['test'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        type: 'string',
        description: 'Test ID',
      },
    ],
    requestBody: undefined,
    responses: [
      {
        statusCode: '200',
        description: 'Success',
        contentType: 'application/json',
        schema: { type: 'object' },
      },
    ],
    security: [],
    deprecated: false,
  };

  const config = {
    language: 'go' as const,
    packageName: 'test-mcp-server',
    serviceName: 'TestAPI',
    serviceVersion: '1.0.0',
    outputPath: '', // Don't write files during test
    author: 'Test',
    description: 'Test MCP server',
    license: 'MIT',
  };

  const options = {
    includeTests: false,
    includeDocs: false,
    includeExamples: false,
    validationLevel: 'basic' as const,
    outputFormat: 'multi-file' as const,
    useTinyGo: true,
  };

  const generator = new GoMCPGenerator();
  const result = await generator.generate(config, options, [testEndpoint]);

  // Test results
  if (result.success) {
    console.log('✅ Code generation test passed');
    console.log(`📄 Generated ${result.files.length} files`);

    // Check that essential files are generated
    const fileNames = result.files.map(f => f.path);
    const essentialFiles = [
      'go.mod',
      'main.go',
      'internal/server/server.go',
      'internal/tools/registry.go',
      'internal/tools/tool.go',
      'internal/config/config.go',
      'internal/models/server.go',
      'README.md'
    ];

    const missingFiles = essentialFiles.filter(file => !fileNames.includes(file));
    if (missingFiles.length > 0) {
      console.error('❌ Missing essential files:', missingFiles);
      return false;
    }

    // Check file contents
    const mainGo = result.files.find(f => f.path === 'main.go');
    if (mainGo && mainGo.content.includes('testEndpoint')) {
      console.log('✅ Tool registration found in main.go');
    } else {
      console.error('❌ Tool registration missing in main.go');
      return false;
    }

    console.log('✅ All essential files generated with correct content');
    return true;
  } else {
    console.error('❌ Code generation test failed:');
    result.errors.forEach(error => {
      console.error(`   ${error.code}: ${error.message}`);
    });
    return false;
  }
}

// Run the test
testCodeGeneration()
  .then(success => {
    console.log(success ? '\n🎉 All tests passed!' : '\n💥 Some tests failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });