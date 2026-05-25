import type { ProjectFile, ProjectDependency, AnalysisResult, DependencyMetadata } from '../types';

export interface AnalysisOptions {
  includeTypeDependencies?: boolean;
  includeDynamicImports?: boolean;
  maxFileSize?: number;
  ignorePatterns?: RegExp[];
}

export interface FileAnalysisContext {
  workspace: {
    rootPath: string;
    name: string;
  };
  filePath: string;
  relativePath: string;
  content: string;
  language: string;
  options: AnalysisOptions;
}

/**
 * Base interface for language-specific analyzers
 */
export interface LanguageAnalyzer {
  /**
   * Get the file extensions this analyzer handles
   */
  getSupportedExtensions(): string[];

  /**
   * Get the language name
   */
  getLanguageName(): string;

  /**
   * Analyze a file and extract dependencies
   */
  analyzeFile(context: FileAnalysisContext): Promise<{
    dependencies: ProjectDependency[];
    metadata: AnalysisMetadata;
    errors: any[];
  }>;

  /**
   * Check if this analyzer can handle the file
   */
  canAnalyze(filePath: string, content?: string): boolean;
}

export interface AnalysisMetadata {
  language: string;
  size: {
    lines: number;
    bytes: number;
    characters: number;
  };
  complexity: {
    imports: number;
    exports: number;
    functions: number;
    classes: number;
  };
  features: {
    hasAsync: boolean;
    hasClasses: boolean;
    hasModules: boolean;
    hasTypes: boolean;
    hasGenerics: boolean;
  };
}

export abstract class BaseLanguageAnalyzer implements LanguageAnalyzer {
  protected abstract extensions: string[];
  protected abstract language: string;

  getSupportedExtensions(): string[] {
    return this.extensions;
  }

  getLanguageName(): string {
    return this.language;
  }

  canAnalyze(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return this.extensions.includes(ext);
  }

  async analyzeFile(context: FileAnalysisContext): Promise<{
    dependencies: ProjectDependency[];
    metadata: AnalysisMetadata;
    errors: any[];
  }> {
    // Default implementation - subclasses should override this
    return {
      dependencies: [],
      metadata: this.createFallbackMetadata(context),
      errors: []
    };
  }

  protected createFallbackMetadata(context: FileAnalysisContext): AnalysisMetadata {
    const stats = this.getFileStats(context.content);

    return {
      language: this.language,
      size: stats,
      complexity: {
        imports: 0,
        exports: 0,
        functions: 0,
        classes: 0
      },
      features: {
        hasAsync: false,
        hasClasses: false,
        hasModules: false,
        hasTypes: false,
        hasGenerics: false
      }
    };
  }

  protected getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot >= 0 ? filePath.substring(lastDot) : '';
  }

  protected createDependency(
    from: string,
    to: string,
    type: string,
    metadata?: DependencyMetadata
  ): ProjectDependency {
    return {
      from,
      to,
      type: type as any,
      strength: this.calculateStrength(type),
      metadata
    };
  }

  protected calculateStrength(type: string): any {
    switch (type) {
      case 'import':
        return 'medium' as any;
      case 'export':
        return 'medium' as any;
      case 'call':
        return 'strong' as any;
      case 'inheritance':
        return 'strong' as any;
      case 'composition':
        return 'strong' as any;
      case 'type-reference':
        return 'weak' as any;
      default:
        return 'medium' as any;
    }
  }

  protected resolveImportPath(importPath: string, fromPath: string, rootPath: string): string {
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
      const resolved = this.normalizePath(fromDir + '/' + importPath);
      return this.addExtensionIfMissing(resolved);
    }

    // Handle absolute imports (assuming they start from root)
    if (!importPath.startsWith('/') && !importPath.startsWith('./')) {
      return this.addExtensionIfMissing('/' + importPath);
    }

    return importPath;
  }

  protected normalizePath(path: string): string {
    return path
      .split('/')
      .filter((part, index, parts) => {
        if (part === '..') {
          // Remove the previous directory
          return false;
        }
        if (part === '.') {
          // Skip current directory
          return false;
        }
        return true;
      })
      .join('/');
  }

  protected addExtensionIfMissing(path: string): string {
    if (this.getFileExtension(path) === '') {
      return path + '.js'; // Default extension
    }
    return path;
  }

  protected getFileStats(content: string): { lines: number; bytes: number; characters: number } {
    const lines = content.split('\n').length;
    // Use TextEncoder instead of Buffer for Cloudflare Workers compatibility
    const bytes = new TextEncoder().encode(content).length;
    const characters = content.length;

    return { lines, bytes, characters };
  }

  protected isTypeOnlyImport(importPath: string): boolean {
    return importPath.includes('type ') || importPath.startsWith('type ');
  }

  protected isDynamicImport(importPath: string): boolean {
    return importPath.includes('import(') && importPath.includes('from');
  }
}