import { BaseLanguageAnalyzer, FileAnalysisContext, AnalysisOptions, AnalysisMetadata } from './LanguageAnalyzer';
import type { ProjectDependency, DependencyMetadata, FileContent, FileAnalysisResult } from '../types';

export interface PythonAnalyzerOptions extends AnalysisOptions {
  pythonVersion?: string;
  parseComments?: boolean;
}

/**
 * Python AST-based analyzer (simplified regex-based for now)
 */
export class PythonAnalyzer extends BaseLanguageAnalyzer {
  protected extensions = ['.py', '.pyi'];
  protected language = 'python';

  private options: PythonAnalyzerOptions;

  constructor(options: PythonAnalyzerOptions = {}) {
    super();
    this.options = {
      includeTypeDependencies: true,
      pythonVersion: '3.9',
      parseComments: true,
      ...options
    };
  }

  async analyzeFile(context: FileAnalysisContext): Promise<{
    dependencies: ProjectDependency[];
    metadata: AnalysisMetadata;
    errors: any[];
  }> {
    try {
      const dependencies: ProjectDependency[] = [];
      const errors: any[] = [];
      const stats = this.getFileStats(context.content);

      // Simple regex-based parsing for Python imports
      this.parseImports(context, dependencies);

      const metadata: AnalysisMetadata = {
        language: this.language,
        size: stats,
        complexity: {
          imports: dependencies.filter(d => d.type === 'import').length,
          exports: 0, // Hard to detect exports in Python without full AST
          functions: this.countFunctions(context.content),
          classes: this.countClasses(context.content)
        },
        features: {
          hasAsync: context.content.includes('async def '),
          hasClasses: context.content.includes('class '),
          hasModules: dependencies.length > 0,
          hasTypes: context.content.includes('List[') || context.content.includes('Dict['),
          hasGenerics: context.content.includes('TypeVar')
        }
      };

      return { dependencies, metadata, errors };
    } catch (error) {
      console.error(`Error analyzing ${context.filePath}:`, error);
      return {
        dependencies: [],
        metadata: this.createFallbackMetadata(context),
        errors: [error]
      };
    }
  }

  private parseImports(context: FileAnalysisContext, dependencies: ProjectDependency[]): void {
    const lines = context.content.split('\n');

    lines.forEach((line, index) => {
      line = line.trim();

      // import x
      const importMatch = line.match(/^import\s+([\w.]+)/);
      if (importMatch) {
        const importPath = importMatch[1];
        this.addDependency(importPath, context, index + 1, dependencies);
      }

      // from x import y
      const fromMatch = line.match(/^from\s+([\w.]+)\s+import/);
      if (fromMatch) {
        const importPath = fromMatch[1];
        this.addDependency(importPath, context, index + 1, dependencies);
      }
    });
  }

  private addDependency(importPath: string, context: FileAnalysisContext, line: number, dependencies: ProjectDependency[]): void {
    // Convert python dot notation to path
    const path = importPath.replace(/\./g, '/');
    // We don't really know if it's relative or absolute without more context, 
    // but for now treat local imports if they start with .
    // Actually python imports are usually absolute or relative with .

    const resolvedPath = path; // Simplified resolution

    const metadata: DependencyMetadata = {
      lineNumbers: [line],
      sourceType: 'import'
    };

    dependencies.push(this.createDependency(
      context.relativePath,
      resolvedPath,
      'import',
      metadata
    ));
  }

  private countFunctions(content: string): number {
    return (content.match(/^def\s+/gm) || []).length;
  }

  private countClasses(content: string): number {
    return (content.match(/^class\s+/gm) || []).length;
  }
}