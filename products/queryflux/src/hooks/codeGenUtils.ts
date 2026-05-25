/**
 * Code Generation — utility functions
 */

import type {
  TableSchema,
  DatabaseSchema,
  CodeGenerationRequest,
  CodeGenerationResult,
} from './codeGenTypes';
import type { Language, Framework, Template } from './codeGenConfig';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    ts: '📘', tsx: '⚛️', js: '📜', jsx: '⚛️', py: '🐍', go: '🐹',
    java: '☕', rs: '🦀', cs: '💜', php: '🐘', rb: '💎',
    sql: '🗃️', json: '📋', yaml: '📝', yml: '📝', md: '📄',
  };
  return icons[ext || ''] || '📄';
}

export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const languages: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python', go: 'Go', java: 'Java', rs: 'Rust', cs: 'C#', php: 'PHP', rb: 'Ruby',
  };
  return languages[ext || ''] || 'Unknown';
}

export function filterTables(tables: TableSchema[], selectedTables: string[]): TableSchema[] {
  if (selectedTables.length === 0) return tables;
  return tables.filter(table => selectedTables.includes(table.name));
}

export function calculateSchemaStats(schema: DatabaseSchema) {
  const stats = { totalTables: schema.tables.length, totalColumns: 0, totalIndexes: 0, totalForeignKeys: 0 };
  schema.tables.forEach(table => {
    stats.totalColumns += table.columns.length;
    stats.totalIndexes += table.indexes?.length || 0;
    stats.totalForeignKeys += table.foreignKeys?.length || 0;
  });
  return stats;
}

export function generateDefaultRequest(
  schema: DatabaseSchema,
  language: Language = 'typescript',
  framework: Framework = 'prisma',
  template: Template = 'orm_models'
): CodeGenerationRequest {
  return { language, framework, template, tables: schema.tables.map(t => t.name), schema, outputFormat: 'multi_file', options: {} };
}

export async function downloadFiles(result: CodeGenerationResult): Promise<void> {
  for (const file of result.files) {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export function getFilePreview(content: string, maxLines = 50): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join('\n') + `\n\n... (${lines.length - maxLines} more lines)`;
}
