import { ExtractedEndpoint, ExtractedSchema } from '@mcpoverflow/openapi-parser';

export interface CodegenConfig {
  language: 'go' | 'typescript' | 'python';
  packageName: string;
  serviceName: string;
  serviceVersion: string;
  outputPath: string;
  templateDir?: string;
  author?: string;
  description?: string;
  license?: string;
  repository?: string;
}

export interface GeneratorOptions {
  includeTests?: boolean;
  includeDocs?: boolean;
  includeExamples?: boolean;
  validationLevel?: 'basic' | 'strict' | 'none';
  outputFormat?: 'single-file' | 'multi-file';
  useTinyGo?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: MCPParameter[];
  returnType: string;
  methodName: string;
  endpoint: ExtractedEndpoint;
}

export interface MCPParameter {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  schema?: any;
  validation?: MCPValidation[];
}

export interface MCPValidation {
  type: 'required' | 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value?: any;
  message?: string;
}

export interface MCPSchema {
  name: string;
  type: string;
  properties: Record<string, MCPProperty>;
  required: string[];
  description?: string;
}

export interface MCPProperty {
  type: string;
  description?: string;
  required: boolean;
  validation?: MCPValidation[];
  defaultValue?: any;
}

export interface CodeGenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors: CodegenError[];
  warnings: CodegenWarning[];
  metadata: CodegenMetadata;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'source' | 'test' | 'doc' | 'config' | 'template';
  language: string;
  size: number;
}

export interface CodegenError {
  code: string;
  message: string;
  path?: string;
  severity: 'error';
  details?: any;
}

export interface CodegenWarning {
  code: string;
  message: string;
  path?: string;
  severity: 'warning';
  details?: any;
}

export interface CodegenMetadata {
  language: string;
  package: string;
  version: string;
  fileCount: number;
  lineCount: number;
  generatedAt: Date;
  config: CodegenConfig;
  options: GeneratorOptions;
}

export interface TemplateContext {
  config: CodegenConfig;
  options: GeneratorOptions;
  tools: MCPTool[];
  schemas: MCPSchema[];
  endpoints: ExtractedEndpoint[];
  utilities: {
    toPascalCase: (str: string) => string;
    toCamelCase: (str: string) => string;
    toSnakeCase: (str: string) => string;
    toKebabCase: (str: string) => string;
    pluralize: (str: string) => string;
    singularize: (str: string) => string;
    formatDate: (date: Date) => string;
    escapeString: (str: string) => string;
  };
}

export interface LanguageGenerator {
  generate(config: CodegenConfig, options: GeneratorOptions, endpoints: ExtractedEndpoint[]): Promise<CodeGenerationResult>;
  validateConfig(config: CodegenConfig): CodegenError[];
  getTemplateFiles(): string[];
  getSupportedFeatures(): string[];
}

export interface CodeTemplate {
  name: string;
  description: string;
  language: string;
  path: string;
  variables: TemplateVariable[];
  content: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: MCPValidation[];
}