import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  CodegenConfig,
  GeneratorOptions,
  LanguageGenerator,
  CodeGenerationResult,
  GeneratedFile,
  CodegenError,
  CodegenWarning,
  CodegenMetadata,
  TemplateContext,
} from './types';
import {
  createTemplateContext,
  calculateFileStats,
  validateGoPackageName,
  generateGoImportPath,
} from './utils';
import { ExtractedEndpoint, ExtractedSchema } from '@mcpoverflow/openapi-parser';

export class GoMCPGenerator implements LanguageGenerator {
  private templateDir: string;
  private handlebars: typeof Handlebars;

  constructor(templateDir?: string) {
    this.templateDir = templateDir || path.join(__dirname, '../templates/go');
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Generate Go MCP server code from OpenAPI endpoints
   */
  async generate(
    config: CodegenConfig,
    options: GeneratorOptions,
    endpoints: ExtractedEndpoint[],
    schemas: ExtractedSchema[] = []
  ): Promise<CodeGenerationResult> {
    const errors: CodegenError[] = [];
    const warnings: CodegenWarning[] = [];
    const files: GeneratedFile[] = [];

    try {
      // Validate configuration
      const configErrors = this.validateConfig(config);
      errors.push(...configErrors);

      if (errors.length > 0) {
        return this.createResult(files, errors, warnings, config, options);
      }

      // Create template context
      const context = createTemplateContext(config, options, endpoints, schemas);

      // Load templates
      const templates = await this.loadTemplates();

      // Generate files
      for (const template of templates) {
        try {
          const content = this.handlebars.compile(template.content)(context);
          const filePath = this.resolveOutputPath(template.name, config, options);
          const { lines, size } = calculateFileStats(content);

          files.push({
            path: filePath,
            content,
            type: this.getFileType(template.name),
            language: 'go',
            size,
          });

          // Write file if output path is specified
          if (config.outputPath) {
            await this.writeFile(filePath, content);
          }
        } catch (error) {
          errors.push({
            code: 'TEMPLATE_ERROR',
            message: `Failed to process template ${template.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path: template.name,
            severity: 'error',
            details: error,
          });
        }
      }

      // Generate additional files
      await this.generateAdditionalFiles(context, files, errors, warnings);

      return this.createResult(files, errors, warnings, config, options);
    } catch (error) {
      errors.push({
        code: 'GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown generation error',
        severity: 'error',
        details: error,
      });
      return this.createResult(files, errors, warnings, config, options);
    }
  }

  /**
   * Validate code generation configuration
   */
  validateConfig(config: CodegenConfig): CodegenError[] {
    const errors: CodegenError[] = [];

    if (!config.packageName) {
      errors.push({
        code: 'MISSING_PACKAGE_NAME',
        message: 'Package name is required',
        severity: 'error',
      });
    } else if (!validateGoPackageName(config.packageName)) {
      errors.push({
        code: 'INVALID_PACKAGE_NAME',
        message: 'Package name must be a valid Go identifier (lowercase, alphanumeric)',
        severity: 'error',
      });
    }

    if (!config.serviceName) {
      errors.push({
        code: 'MISSING_SERVICE_NAME',
        message: 'Service name is required',
        severity: 'error',
      });
    }

    if (!config.serviceVersion) {
      errors.push({
        code: 'MISSING_SERVICE_VERSION',
        message: 'Service version is required',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Get list of template files
   */
  getTemplateFiles(): string[] {
    return [
      'go.mod.hbs',
      'main.go.hbs',
      'internal/server/server.go.hbs',
      'internal/tools/registry.go.hbs',
      'internal/tools/tool.go.hbs',
      'internal/config/config.go.hbs',
      'internal/models/server.go.hbs',
      'internal/agentkit/agentkit.go.hbs',
      'agentkit.yaml.hbs',
      'manifest.json.hbs',
      'README.md.hbs',
    ];
  }

  /**
   * Get supported features
   */
  getSupportedFeatures(): string[] {
    return [
      'go-generation',
      'mcp-protocol',
      'websocket-support',
      'http-support',
      'tinygo-compatible',
      'validation',
      'error-handling',
      'configuration',
      'logging',
      'agentkit-integration',
      'autonomous-agents',
      'cloudflare-workers',
      'manifest-generation',
      'lifecycle-management',
    ];
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      return this.toPascalCase(str);
    });

    this.handlebars.registerHelper('camelCase', (str: string) => {
      return this.toCamelCase(str);
    });

    this.handlebars.registerHelper('snakeCase', (str: string) => {
      return this.toSnakeCase(str);
    });

    this.handlebars.registerHelper('kebabCase', (str: string) => {
      return this.toKebabCase(str);
    });

    this.handlebars.registerHelper('uppercase', (str: string) => {
      return str.toUpperCase();
    });

    this.handlebars.registerHelper('lowercase', (str: string) => {
      return str.toLowerCase();
    });

    this.handlebars.registerHelper('escapeString', (str: string) => {
      return this.escapeString(str);
    });

    this.handlebars.registerHelper('formatDate', (date: Date) => {
      return date.toISOString();
    });

    this.handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    this.handlebars.registerHelper('ne', (a: any, b: any) => {
      return a !== b;
    });

    this.handlebars.registerHelper('unless', (conditional: boolean, options: any) => {
      if (!conditional) {
        return options.fn(this);
      }
      return options.inverse(this);
    });
  }

  /**
   * Load all templates from the template directory
   */
  private async loadTemplates(): Promise<Array<{ name: string; content: string }>> {
    const templates: Array<{ name: string; content: string }> = [];

    try {
      const templateFiles = await fs.readdir(this.templateDir, { recursive: true });

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const filePath = path.join(this.templateDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          templates.push({
            name: file.replace('.hbs', ''),
            content,
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to load templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return templates;
  }

  /**
   * Generate additional files that aren't based on templates
   */
  private async generateAdditionalFiles(
    context: TemplateContext,
    files: GeneratedFile[],
    errors: CodegenError[],
    warnings: CodegenWarning[]
  ): Promise<void> {
    // Generate tool files for each endpoint
    for (const tool of context.tools) {
      try {
        const toolTemplate = await this.loadToolTemplate();
        const content = this.handlebars.compile(toolTemplate)({ ...context, tool });
        const filePath = `internal/tools/${tool.name}.go`;
        const { lines, size } = calculateFileStats(content);

        files.push({
          path: filePath,
          content,
          type: 'source',
          language: 'go',
          size,
        });

        if (context.config.outputPath) {
          await this.writeFile(filePath, content);
        }
      } catch (error) {
        errors.push({
          code: 'TOOL_GENERATION_ERROR',
          message: `Failed to generate tool ${tool.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
          details: error,
        });
      }
    }

    // Generate .gitignore if requested
    if (context.options.includeDocs) {
      const gitignoreContent = this.generateGitignore();
      files.push({
        path: '.gitignore',
        content: gitignoreContent,
        type: 'config',
        language: 'text',
        size: gitignoreContent.length,
      });

      if (context.config.outputPath) {
        await this.writeFile('.gitignore', gitignoreContent);
      }
    }
  }

  /**
   * Load tool template
   */
  private async loadToolTemplate(): Promise<string> {
    const toolTemplatePath = path.join(this.templateDir, 'internal/tools/tool.go.hbs');
    return await fs.readFile(toolTemplatePath, 'utf-8');
  }

  /**
   * Generate .gitignore content
   */
  private generateGitignore(): string {
    return `# Binaries for programs and plugins
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary, built with \`go test -c\`
*.test

# Output of the go coverage tool, specifically when used with LiteIDE
*.out

# Dependency directories (remove the comment below to include it)
vendor/

# Go workspace file
go.work

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Build output
dist/
build/
*.log
`;
  }

  /**
   * Resolve output path for a template
   */
  private resolveOutputPath(templateName: string, config: CodegenConfig, options: GeneratorOptions): string {
    return templateName.replace('.hbs', '');
  }

  /**
   * Get file type based on template name
   */
  private getFileType(templateName: string): 'source' | 'test' | 'doc' | 'config' | 'template' {
    if (templateName.endsWith('.go')) return 'source';
    if (templateName.endsWith('_test.go')) return 'test';
    if (templateName.endsWith('.md')) return 'doc';
    if (templateName === 'go.mod') return 'config';
    if (templateName.endsWith('.hbs')) return 'template';
    return 'source';
  }

  /**
   * Write file to disk
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);

    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Create generation result
   */
  private createResult(
    files: GeneratedFile[],
    errors: CodegenError[],
    warnings: CodegenWarning[],
    config: CodegenConfig,
    options: GeneratorOptions
  ): CodeGenerationResult {
    const totalLines = files.reduce((sum, file) => sum + file.size, 0);
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    const metadata: CodegenMetadata = {
      language: 'go',
      package: config.packageName,
      version: config.serviceVersion,
      fileCount: files.length,
      lineCount: Math.floor(totalLines / 50), // Rough estimate
      generatedAt: new Date(),
      config,
      options,
    };

    return {
      success: errors.length === 0,
      files,
      errors,
      warnings,
      metadata,
    };
  }

  // Helper methods
  private toPascalCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toUpperCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '')
      .replace(/[-_]/g, '');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('_');
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('-');
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}