/**
 * Code Generation — shared types
 */

export interface DatabaseSchema {
  tables: TableSchema[];
  views?: ViewSchema[];
  enums?: EnumSchema[];
  connection: ConnectionInfo;
  introspectedAt: string;
}

export interface TableSchema {
  name: string;
  schema?: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys?: ForeignKey[];
  indexes?: IndexSchema[];
  comment?: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  autoIncrement: boolean;
  comment?: string;
  enumValues?: string[];
}

export interface ForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
  type?: string;
}

export interface ViewSchema {
  name: string;
  schema?: string;
  definition: string;
  columns: ColumnSchema[];
  comment?: string;
}

export interface EnumSchema {
  name: string;
  values: string[];
}

export interface ConnectionInfo {
  id: string;
  name: string;
  type: string;
  host?: string;
  port?: number;
  database?: string;
}

export interface CodeGenerationRequest {
  language: string;
  framework: string;
  template: string;
  tables: string[];
  schema: DatabaseSchema;
  outputFormat: 'single_file' | 'multi_file' | 'archive';
  options?: Record<string, unknown>;
}

export interface CodeGenerationResult {
  files: GeneratedFile[];
  validation: ValidationResult;
  generatedAt: string;
  language: string;
  framework: string;
  totalLines: number;
  totalFiles: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
}

export interface UseCodeGenerationReturn {
  introspectSchema: (connectionId: string) => Promise<DatabaseSchema>;
  isIntrospecting: boolean;
  schema: DatabaseSchema | null;
  generateCode: (request: CodeGenerationRequest) => Promise<CodeGenerationResult>;
  isGenerating: boolean;
  result: CodeGenerationResult | null;
  generateWithAI: (prompt: string, schema: DatabaseSchema) => Promise<CodeGenerationResult>;
  isAIGenerating: boolean;
  error: Error | null;
  reset: () => void;
}
