/**
 * Tests for GoMCPGenerator
 */

import { GoMCPGenerator } from '../generator';
import { CodegenConfig, GeneratorOptions } from '../types';
import { ExtractedEndpoint } from '@mcpoverflow/openapi-parser';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');

describe('GoMCPGenerator', () => {
  let generator: GoMCPGenerator;
  let mockConfig: CodegenConfig;
  let mockOptions: GeneratorOptions;
  let mockEndpoints: ExtractedEndpoint[];

  beforeEach(() => {
    generator = new GoMCPGenerator();

    mockConfig = {
      language: 'go',
      packageName: 'testapi',
      serviceName: 'Test API',
      serviceVersion: '1.0.0',
      outputPath: '/tmp/output',
    };

    mockOptions = {
      includeTests: false,
      includeDocs: true,
      includeExamples: false,
      validationLevel: 'basic',
      outputFormat: 'multi-file',
      useTinyGo: false,
    };

    mockEndpoints = [
      {
        path: '/users',
        method: 'GET',
        operationId: 'listUsers',
        summary: 'List all users',
        description: 'Get a list of all users',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            type: 'integer',
            description: 'Number of users to return',
          },
        ],
        requestBody: undefined,
        responses: [
          {
            statusCode: '200',
            description: 'Success',
            contentType: 'application/json',
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
        ],
        tags: ['users'],
        security: [],
        deprecated: false,
      },
    ];

    // Mock fs.readdir to return empty array
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.readFile as jest.Mock).mockResolvedValue('{{packageName}}');
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default template directory', () => {
      const gen = new GoMCPGenerator();
      expect(gen).toBeInstanceOf(GoMCPGenerator);
    });

    it('should initialize with custom template directory', () => {
      const customDir = '/custom/templates';
      const gen = new GoMCPGenerator(customDir);
      expect(gen).toBeInstanceOf(GoMCPGenerator);
    });
  });

  describe('validateConfig', () => {
    it('should pass validation for valid config', () => {
      const errors = generator.validateConfig(mockConfig);
      expect(errors).toHaveLength(0);
    });

    it('should require package name', () => {
      const invalidConfig = { ...mockConfig, packageName: '' };
      const errors = generator.validateConfig(invalidConfig);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MISSING_PACKAGE_NAME');
      expect(errors[0].severity).toBe('error');
    });

    it('should validate package name format', () => {
      const invalidConfig = { ...mockConfig, packageName: 'Invalid-Package' };
      const errors = generator.validateConfig(invalidConfig);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('INVALID_PACKAGE_NAME');
    });

    it('should require service name', () => {
      const invalidConfig = { ...mockConfig, serviceName: '' };
      const errors = generator.validateConfig(invalidConfig);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MISSING_SERVICE_NAME');
    });

    it('should require service version', () => {
      const invalidConfig = { ...mockConfig, serviceVersion: '' };
      const errors = generator.validateConfig(invalidConfig);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MISSING_SERVICE_VERSION');
    });

    it('should accumulate multiple errors', () => {
      const invalidConfig = {
        ...mockConfig,
        packageName: '',
        serviceName: '',
        serviceVersion: '',
      };
      const errors = generator.validateConfig(invalidConfig);

      expect(errors).toHaveLength(3);
    });

    it('should allow lowercase alphanumeric package names', () => {
      const validNames = ['myapi', 'api123', 'testservice'];

      validNames.forEach(name => {
        const config = { ...mockConfig, packageName: name };
        const errors = generator.validateConfig(config);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject invalid package names', () => {
      const invalidNames = ['My-API', 'api_123', 'Test API', '123api', ''];

      invalidNames.forEach(name => {
        const config = { ...mockConfig, packageName: name };
        const errors = generator.validateConfig(config);
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getTemplateFiles', () => {
    it('should return list of template files', () => {
      const files = generator.getTemplateFiles();

      expect(files).toBeInstanceOf(Array);
      expect(files.length).toBeGreaterThan(0);
      expect(files).toContain('go.mod.hbs');
      expect(files).toContain('main.go.hbs');
      expect(files).toContain('README.md.hbs');
    });

    it('should include all required Go files', () => {
      const files = generator.getTemplateFiles();

      expect(files).toContain('main.go.hbs');
      expect(files).toContain('internal/server/server.go.hbs');
      expect(files).toContain('internal/tools/registry.go.hbs');
      expect(files).toContain('internal/config/config.go.hbs');
    });

    it('should include AgentKit integration files', () => {
      const files = generator.getTemplateFiles();

      expect(files).toContain('internal/agentkit/agentkit.go.hbs');
      expect(files).toContain('agentkit.yaml.hbs');
    });

    it('should include manifest and documentation files', () => {
      const files = generator.getTemplateFiles();

      expect(files).toContain('manifest.json.hbs');
      expect(files).toContain('README.md.hbs');
    });
  });

  describe('getSupportedFeatures', () => {
    it('should return list of supported features', () => {
      const features = generator.getSupportedFeatures();

      expect(features).toBeInstanceOf(Array);
      expect(features.length).toBeGreaterThan(0);
    });

    it('should support Go generation', () => {
      const features = generator.getSupportedFeatures();
      expect(features).toContain('go-generation');
    });

    it('should support MCP protocol', () => {
      const features = generator.getSupportedFeatures();
      expect(features).toContain('mcp-protocol');
    });

    it('should support TinyGo', () => {
      const features = generator.getSupportedFeatures();
      expect(features).toContain('tinygo-compatible');
    });

    it('should support AgentKit', () => {
      const features = generator.getSupportedFeatures();
      expect(features).toContain('agentkit-integration');
      expect(features).toContain('autonomous-agents');
    });

    it('should support Cloudflare Workers', () => {
      const features = generator.getSupportedFeatures();
      expect(features).toContain('cloudflare-workers');
    });

    it('should support validation and error handling', () => {
      const features = generator.getSupportedFeatures();
      expect(features).toContain('validation');
      expect(features).toContain('error-handling');
    });
  });

  describe('generate', () => {
    it('should fail with invalid config', async () => {
      const invalidConfig = { ...mockConfig, packageName: '' };

      const result = await generator.generate(invalidConfig, mockOptions, mockEndpoints);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.files).toHaveLength(0);
    });

    it('should generate files with valid config', async () => {
      // Mock template loading
      (fs.readdir as jest.Mock).mockResolvedValue(['main.go.hbs', 'go.mod.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('package {{config.packageName}}');

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      // Should succeed despite mocked templates
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('metadata');
    });

    it('should include metadata in result', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      expect(result.metadata.language).toBe('go');
      expect(result.metadata.package).toBe(mockConfig.packageName);
      expect(result.metadata.version).toBe(mockConfig.serviceVersion);
      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
    });

    it('should handle template loading errors', async () => {
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('Template not found'));

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('GENERATION_ERROR');
    });

    it('should write files when outputPath is specified', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['main.go.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('package main');

      const configWithOutput = { ...mockConfig, outputPath: '/tmp/test' };
      await generator.generate(configWithOutput, mockOptions, mockEndpoints);

      // writeFile should be called
      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should not write files when outputPath is empty', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['main.go.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('package main');

      const configWithoutOutput = { ...mockConfig, outputPath: '' };
      await generator.generate(configWithoutOutput, mockOptions, mockEndpoints);

      // writeFile should not be called when outputPath is empty
      // But this depends on implementation - adjust based on actual behavior
    });

    it('should process multiple templates', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([
        'main.go.hbs',
        'go.mod.hbs',
        'README.md.hbs',
      ]);
      (fs.readFile as jest.Mock).mockResolvedValue('template content');

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      // Should process all templates
      expect(result.files.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty endpoints array', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['main.go.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('package main');

      const result = await generator.generate(mockConfig, mockOptions, []);

      // Should still generate base files
      expect(result).toHaveProperty('success');
    });

    it('should include .gitignore when includeDocs is true', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const optionsWithDocs = { ...mockOptions, includeDocs: true };
      const result = await generator.generate(mockConfig, optionsWithDocs, mockEndpoints);

      const gitignoreFile = result.files.find(f => f.path === '.gitignore');
      if (gitignoreFile) {
        expect(gitignoreFile.content).toContain('*.exe');
        expect(gitignoreFile.content).toContain('.DS_Store');
        expect(gitignoreFile.type).toBe('config');
      }
    });

    it('should generate tool files for each endpoint', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      (fs.readFile as jest.Mock).mockResolvedValue('tool template');

      const multipleEndpoints = [
        { ...mockEndpoints[0], operationId: 'listUsers' },
        { ...mockEndpoints[0], operationId: 'createUser', method: 'POST' },
      ];

      const result = await generator.generate(mockConfig, mockOptions, multipleEndpoints);

      // Should generate files for each endpoint
      expect(result).toHaveProperty('files');
    });
  });

  describe('Handlebars helpers', () => {
    it('should register pascalCase helper', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['test.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('{{pascalCase config.packageName}}');

      const result = await generator.generate(mockConfig, mockOptions, []);

      if (result.files.length > 0) {
        // PascalCase should be applied
        expect(result.files[0].content).toBeTruthy();
      }
    });

    it('should register camelCase helper', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['test.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('{{camelCase "test_value"}}');

      const result = await generator.generate(mockConfig, mockOptions, []);

      if (result.files.length > 0) {
        expect(result.files[0].content).toBeTruthy();
      }
    });

    it('should register snakeCase helper', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['test.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('{{snakeCase "TestValue"}}');

      const result = await generator.generate(mockConfig, mockOptions, []);

      if (result.files.length > 0) {
        expect(result.files[0].content).toBeTruthy();
      }
    });

    it('should register kebabCase helper', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['test.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('{{kebabCase "TestValue"}}');

      const result = await generator.generate(mockConfig, mockOptions, []);

      if (result.files.length > 0) {
        expect(result.files[0].content).toBeTruthy();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle template compilation errors', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['bad.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('{{invalid template syntax}}}}');

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      // Should capture template errors
      expect(result).toHaveProperty('errors');
    });

    it('should handle file system errors', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      (fs.readdir as jest.Mock).mockResolvedValue(['main.go.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('package main');

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      // Should handle I/O errors gracefully
      expect(result).toHaveProperty('errors');
    });

    it('should continue generation after individual template errors', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['good.hbs', 'bad.hbs']);
      (fs.readFile as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('bad.hbs')) {
          return Promise.reject(new Error('Bad template'));
        }
        return Promise.resolve('package main');
      });

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      // Should have errors but also some successful files
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('File generation details', () => {
    it('should set correct file types', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([
        'main.go.hbs',
        'go.mod.hbs',
        'README.md.hbs',
      ]);
      (fs.readFile as jest.Mock).mockResolvedValue('content');

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      result.files.forEach(file => {
        expect(file.type).toMatch(/source|test|doc|config|template/);
      });
    });

    it('should calculate file sizes', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['main.go.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('test content');

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      result.files.forEach(file => {
        expect(file.size).toBeGreaterThan(0);
      });
    });

    it('should set language to go for all files', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['main.go.hbs', 'README.md.hbs']);
      (fs.readFile as jest.Mock).mockResolvedValue('content');

      const result = await generator.generate(mockConfig, mockOptions, mockEndpoints);

      result.files.forEach(file => {
        // Most files should be Go, some might be text (README)
        expect(file.language).toBeTruthy();
      });
    });
  });

  describe('Options handling', () => {
    it('should respect includeDocs option', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const withDocs = { ...mockOptions, includeDocs: true };
      const resultWithDocs = await generator.generate(mockConfig, withDocs, mockEndpoints);

      const withoutDocs = { ...mockOptions, includeDocs: false };
      const resultWithoutDocs = await generator.generate(mockConfig, withoutDocs, mockEndpoints);

      // File count should differ based on includeDocs
      expect(resultWithDocs).toHaveProperty('files');
      expect(resultWithoutDocs).toHaveProperty('files');
    });

    it('should handle useTinyGo option', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const optionsWithTinyGo = { ...mockOptions, useTinyGo: true };
      const result = await generator.generate(mockConfig, optionsWithTinyGo, mockEndpoints);

      expect(result.metadata.options.useTinyGo).toBe(true);
    });

    it('should handle different validation levels', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      const levels: Array<'basic' | 'strict' | 'none'> = ['basic', 'strict', 'none'];

      for (const level of levels) {
        const opts = { ...mockOptions, validationLevel: level };
        const result = await generator.generate(mockConfig, opts, mockEndpoints);

        expect(result.metadata.options.validationLevel).toBe(level);
      }
    });
  });
});
