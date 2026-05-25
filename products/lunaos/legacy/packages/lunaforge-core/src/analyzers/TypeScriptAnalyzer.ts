import { BaseLanguageAnalyzer, FileAnalysisContext, LanguageAnalyzer, AnalysisMetadata } from './LanguageAnalyzer';
import * as ts from 'typescript';
import type { ProjectDependency, DependencyMetadata, FileContent, FileAnalysisResult } from '../types';

export interface TypeScriptAnalyzerOptions {
  includeDynamicImports?: boolean;
  followTypeOnlyImports?: boolean;
  resolveTransitiveDependencies?: boolean;
  tsConfig?: any;
}

/**
 * TypeScript/JavaScript AST-based analyzer
 */
export class TypeScriptAnalyzer extends BaseLanguageAnalyzer {
  protected extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  protected language = 'typescript';

  private ts: any; // TypeScript compiler API
  private parser: any; // Acorn parser for JavaScript
  private options: TypeScriptAnalyzerOptions;

  constructor(options: TypeScriptAnalyzerOptions = {}) {
    super();
    this.options = {
      includeDynamicImports: true,
      followTypeOnlyImports: true,
      resolveTransitiveDependencies: false,
      ...options
    };
    this.initializeTypeScript();
  }

  /**
   * Analyze file using FileContent interface (for test compatibility)
   */
  async analyzeFile(context: any): Promise<any> {
    // Handle both raw FileContent (from tests) and FileAnalysisContext (from GraphEngine)
    // BaseLanguageAnalyzer expects FileAnalysisContext.
    // But GraphEngine calls it with FileAnalysisContext.
    // The error in build output said:
    // Argument of type 'FileContent' is not assignable to parameter of type 'FileAnalysisContext'.
    // Wait, no. BaseLanguageAnalyzer.analyzeFile takes FileAnalysisContext.
    // This override logic attempts to handle FileContent too?
    if (!('workspace' in context)) {
      // It's likely FileContent
      return this.analyzeFileContent(context as FileContent);
    }
    return this.analyzeFileWithContext(context as FileAnalysisContext);
  }

  private async analyzeFileContent(content: FileContent): Promise<FileAnalysisResult> {
    try {
      const context: FileAnalysisContext = {
        workspace: {
          rootPath: '/test',
          name: 'test-workspace'
        },
        filePath: content.path,
        relativePath: content.path.replace(/^.*\//, ''),
        content: content.content,
        language: this.isTypeScriptFile(content.path) ? 'typescript' : 'javascript',
        options: this.options
      };

      const result = await this.analyzeFileWithContext(context);

      // Convert to the test-expected format
      return this.convertToFileAnalysisResult(result, content);
    } catch (error: any) {
      console.error(`Error analyzing ${content.path}:`, error);
      return {
        success: false,
        dependencies: [],
        classes: [],
        functions: [],
        exports: [],
        imports: [],
        dynamicImports: [],
        reExports: [],
        typeHints: [],
        inheritance: [],
        hasDefaultExport: false,
        metrics: {
          functionCount: 0,
          classCount: 0,
          complexity: 0
        },
        errors: [{ message: error.message, stack: error.stack, name: error.name }]
      };
    }
  }

  async analyzeFileWithContext(context: FileAnalysisContext): Promise<{
    dependencies: ProjectDependency[];
    metadata: AnalysisMetadata;
    errors: any[];
  }> {
    try {
      if (this.isTypeScriptFile(context.filePath)) {
        return this.analyzeTypeScript(context);
      } else {
        return this.analyzeJavaScript(context);
      }
    } catch (error) {
      console.error(`Error analyzing ${context.filePath}:`, error);
      return {
        dependencies: [],
        metadata: this.createFallbackMetadata(context),
        errors: [error]
      };
    }
  }

  private isTypeScriptFile(filePath: string): boolean {
    return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  }

  private analyzeTypeScript(context: FileAnalysisContext): {
    dependencies: ProjectDependency[];
    metadata: AnalysisMetadata;
    errors: any[];
  } {
    if (!this.ts) {
      // Graceful fallback if TS is not loaded
      return {
        dependencies: [],
        metadata: this.createFallbackMetadata(context),
        errors: [new Error('TypeScript compiler API not available')]
      };
    }

    const sourceFile = this.ts.createSourceFile(
      context.filePath,
      context.content,
      this.ts.ScriptTarget.Latest,
      true
    );

    const dependencies: ProjectDependency[] = [];
    const errors: any[] = [];
    const stats = this.getFileStats(context.content);

    // Walk the AST to extract dependencies
    this.walkTypeScriptAST(sourceFile, dependencies, context, sourceFile);

    const metadata: AnalysisMetadata = {
      language: this.language,
      size: stats,
      complexity: {
        imports: dependencies.filter(d => d.type === 'import').length,
        exports: dependencies.filter(d => d.type === 'export').length,
        functions: this.countFunctions(sourceFile),
        classes: this.countClasses(sourceFile)
      },
      features: {
        hasAsync: this.hasAsyncFunctions(sourceFile),
        hasClasses: this.countClasses(sourceFile) > 0,
        hasModules: dependencies.length > 0,
        hasTypes: this.hasTypeDefinitions(sourceFile),
        hasGenerics: this.hasGenericTypes(sourceFile)
      }
    };

    return { dependencies, metadata, errors };
  }

  private analyzeJavaScript(context: FileAnalysisContext): {
    dependencies: ProjectDependency[];
    metadata: AnalysisMetadata;
    errors: any[];
  } {
    if (!this.parser) {
      // Graceful fallback
      return {
        dependencies: [],
        metadata: this.createFallbackMetadata(context),
        errors: [new Error('JavaScript parser not available')]
      };
    }

    try {
      const ast = this.parser.parse(context.content, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        allowHashBang: true,
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true
      });

      const dependencies: ProjectDependency[] = [];
      const stats = this.getFileStats(context.content);

      // Walk the AST to extract dependencies
      this.walkJavaScriptAST(ast, dependencies, context);

      const metadata: AnalysisMetadata = {
        language: 'javascript',
        size: stats,
        complexity: {
          imports: dependencies.filter(d => d.type === 'import').length,
          exports: dependencies.filter(d => d.type === 'export').length,
          functions: this.countJSFunctions(ast),
          classes: this.countJSClasses(ast)
        },
        features: {
          hasAsync: this.hasJSAsyncFunctions(ast),
          hasClasses: this.countJSClasses(ast) > 0,
          hasModules: dependencies.length > 0,
          hasTypes: false, // JS typically doesn't have explicit types
          hasGenerics: false
        }
      };

      return { dependencies, metadata, errors: [] };
    } catch (error) {
      return {
        dependencies: [],
        metadata: this.createFallbackMetadata(context),
        errors: [error]
      };
    }
  }

  private walkTypeScriptAST(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext, sourceFile: any): void {
    if (!node) return;

    switch (node.kind) {
      case this.ts.SyntaxKind.ImportDeclaration:
        this.handleTypeScriptImport(node, dependencies, context, sourceFile);
        break;

      case this.ts.SyntaxKind.ExportDeclaration:
        this.handleTypeScriptExport(node, dependencies, context, sourceFile);
        break;

      case this.ts.SyntaxKind.CallExpression:
        this.handleTypeScriptCall(node, dependencies, context, sourceFile);
        break;

      case this.ts.SyntaxKind.ClassDeclaration:
        this.handleTypeScriptClass(node, dependencies, context, sourceFile);
        break;

      case this.ts.SyntaxKind.ClassExpression:
        this.handleTypeScriptClass(node, dependencies, context, sourceFile);
        break;
    }

    // Recursively walk child nodes
    this.ts.forEachChild(node, (child: any) => {
      this.walkTypeScriptAST(child, dependencies, context, sourceFile);
    });
  }

  private handleTypeScriptImport(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext, sourceFile: any): void {
    if (!node.moduleSpecifier) return;

    const importPath = node.moduleSpecifier.text;
    const resolvedPath = this.resolveImportPath(importPath, context.relativePath, context.workspace.rootPath);

    const metadata: DependencyMetadata = {
      lineNumbers: [this.ts.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1],
      isTypeOnly: node.importClause?.kind === this.ts.SyntaxKind.ImportType,
      isDynamic: false,
      sourceType: 'import'
    };

    dependencies.push(this.createDependency(
      context.relativePath,
      resolvedPath,
      'import',
      metadata
    ));
  }

  private handleTypeScriptExport(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext, sourceFile: any): void {
    if (!node.moduleSpecifier) return;

    const exportPath = node.moduleSpecifier.text;
    const resolvedPath = this.resolveImportPath(exportPath, context.relativePath, context.workspace.rootPath);

    const metadata: DependencyMetadata = {
      lineNumbers: [this.ts.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1],
      isTypeOnly: false,
      isDynamic: false,
      sourceType: 'export'
    };

    dependencies.push(this.createDependency(
      context.relativePath,
      resolvedPath,
      'export',
      metadata
    ));
  }

  private handleTypeScriptCall(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext, sourceFile: any): void {
    // Handle dynamic imports
    if (node.expression.kind === this.ts.SyntaxKind.ImportKeyword) {
      const importArg = node.arguments[0];
      if (importArg && importArg.kind === this.ts.SyntaxKind.StringLiteral) {
        const importPath = importArg.text;
        const resolvedPath = this.resolveImportPath(importPath, context.relativePath, context.workspace.rootPath);

        const metadata: DependencyMetadata = {
          lineNumbers: [this.ts.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1],
          isDynamic: true,
          sourceType: 'dynamic-import'
        };

        dependencies.push(this.createDependency(
          context.relativePath,
          resolvedPath,
          'import',
          metadata
        ));
      }
    }

    // Handle require calls
    if (node.expression.kind === this.ts.SyntaxKind.Identifier &&
      node.expression.text === 'require') {
      const requireArg = node.arguments[0];
      if (requireArg && requireArg.kind === this.ts.SyntaxKind.StringLiteral) {
        const requirePath = requireArg.text;
        const resolvedPath = this.resolveImportPath(requirePath, context.relativePath, context.workspace.rootPath);

        const metadata: DependencyMetadata = {
          lineNumbers: [this.ts.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1],
          sourceType: 'require'
        };

        dependencies.push(this.createDependency(
          context.relativePath,
          resolvedPath,
          'import',
          metadata
        ));
      }
    }
  }

  private handleTypeScriptClass(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext, sourceFile: any): void {
    // Handle inheritance
    if (node.heritageClauses) {
      for (const heritage of node.heritageClauses) {
        if (heritage.token === this.ts.SyntaxKind.ExtendsKeyword) {
          for (const type of heritage.types) {
            const expression = type.expression;
            if (expression && expression.kind === this.ts.SyntaxKind.Identifier) {
              const className = expression.text;

              // Try to resolve class reference
              const resolvedPath = this.resolveClassReference(className, context);
              if (resolvedPath) {
                const metadata: DependencyMetadata = {
                  lineNumbers: [this.ts.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1],
                  sourceType: 'inheritance'
                };

                dependencies.push(this.createDependency(
                  context.relativePath,
                  resolvedPath,
                  'inheritance',
                  metadata
                ));
              }
            }
          }
        }
      }
    }
  }

  private walkJavaScriptAST(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext): void {
    if (!node) return;

    switch (node.type) {
      case 'ImportDeclaration':
        this.handleJSImport(node, dependencies, context);
        break;

      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration':
        this.handleJSExport(node, dependencies, context);
        break;

      case 'CallExpression':
        this.handleJSCall(node, dependencies, context);
        break;

      case 'ClassDeclaration':
      case 'ClassExpression':
        this.handleJSClass(node, dependencies, context);
        break;
    }

    // Recursively walk child nodes
    for (const key in node) {
      const child = node[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach((item: any) => this.walkJavaScriptAST(item, dependencies, context));
        } else if (child.type) {
          this.walkJavaScriptAST(child, dependencies, context);
        }
      }
    }
  }

  private handleJSImport(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext): void {
    if (!node.source || node.source.type !== 'Literal') return;

    const importPath = node.source.value;
    const resolvedPath = this.resolveImportPath(importPath, context.relativePath, context.workspace.rootPath);

    const metadata: DependencyMetadata = {
      lineNumbers: [node.loc?.start?.line],
      isTypeOnly: node.importKind === 'type',
      isDynamic: false,
      sourceType: 'import'
    };

    dependencies.push(this.createDependency(
      context.relativePath,
      resolvedPath,
      'import',
      metadata
    ));
  }

  private handleJSExport(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext): void {
    if (node.type === 'ExportAllDeclaration' && node.source) {
      const exportPath = node.source.value;
      const resolvedPath = this.resolveImportPath(exportPath, context.relativePath, context.workspace.rootPath);

      const metadata: DependencyMetadata = {
        lineNumbers: [node.loc?.start?.line],
        sourceType: 'export'
      };

      dependencies.push(this.createDependency(
        context.relativePath,
        resolvedPath,
        'export',
        metadata
      ));
    }
  }

  private handleJSCall(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext): void {
    // Handle dynamic imports
    if (node.callee && node.callee.type === 'Import') {
      const importArg = node.arguments[0];
      if (importArg && importArg.type === 'Literal') {
        const importPath = importArg.value;
        const resolvedPath = this.resolveImportPath(importPath, context.relativePath, context.workspace.rootPath);

        const metadata: DependencyMetadata = {
          lineNumbers: [node.loc?.start?.line],
          isDynamic: true,
          sourceType: 'dynamic-import'
        };

        dependencies.push(this.createDependency(
          context.relativePath,
          resolvedPath,
          'import',
          metadata
        ));
      }
    }

    // Handle require calls
    if (node.callee && node.callee.type === 'Identifier' && node.callee.name === 'require') {
      const requireArg = node.arguments[0];
      if (requireArg && requireArg.type === 'Literal') {
        const requirePath = requireArg.value;
        const resolvedPath = this.resolveImportPath(requirePath, context.relativePath, context.workspace.rootPath);

        const metadata: DependencyMetadata = {
          lineNumbers: [node.loc?.start?.line],
          sourceType: 'require'
        };

        dependencies.push(this.createDependency(
          context.relativePath,
          resolvedPath,
          'import',
          metadata
        ));
      }
    }
  }

  private handleJSClass(node: any, dependencies: ProjectDependency[], context: FileAnalysisContext): void {
    // Handle inheritance
    if (node.superClass) {
      if (node.superClass.type === 'Identifier') {
        const className = node.superClass.name;
        const resolvedPath = this.resolveClassReference(className, context);
        if (resolvedPath) {
          const metadata: DependencyMetadata = {
            lineNumbers: [node.loc?.start?.line],
            sourceType: 'inheritance'
          };

          dependencies.push(this.createDependency(
            context.relativePath,
            resolvedPath,
            'inheritance',
            metadata
          ));
        }
      }
    }
  }

  private resolveClassReference(className: string, context: FileAnalysisContext): string | null {
    // Simple heuristic: assume class reference is in same directory or a common pattern
    // This could be enhanced with more sophisticated resolution
    return null; // Placeholder - would need more sophisticated class resolution
  }

  // Helper methods for counting AST elements
  private countFunctions(sourceFile: any): number {
    let count = 0;
    this.ts.forEachChild(sourceFile, (node: any) => {
      if (node.kind === this.ts.SyntaxKind.FunctionDeclaration ||
        node.kind === this.ts.SyntaxKind.FunctionExpression ||
        node.kind === this.ts.SyntaxKind.ArrowFunction ||
        node.kind === this.ts.SyntaxKind.MethodDeclaration) {
        count++;
      }
    });
    return count;
  }

  private countClasses(sourceFile: any): number {
    let count = 0;
    this.ts.forEachChild(sourceFile, (node: any) => {
      if (node.kind === this.ts.SyntaxKind.ClassDeclaration ||
        node.kind === this.ts.SyntaxKind.ClassExpression) {
        count++;
      }
    });
    return count;
  }

  private countJSFunctions(ast: any): number {
    let count = 0;
    this.walkJavaScriptAST(ast, [], {} as any);
    return count;
  }

  private countJSClasses(ast: any): number {
    let count = 0;
    const countClass = (node: any) => {
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        count++;
      }
    };

    this.walkJavaScriptAST(ast, [], {} as any);
    return count;
  }

  private hasAsyncFunctions(sourceFile: any): boolean {
    let hasAsync = false;
    this.ts.forEachChild(sourceFile, (node: any) => {
      if ((node.kind === this.ts.SyntaxKind.FunctionDeclaration ||
        node.kind === this.ts.SyntaxKind.FunctionExpression ||
        node.kind === this.ts.SyntaxKind.MethodDeclaration ||
        node.kind === this.ts.SyntaxKind.ArrowFunction) &&
        (node.modifiers?.some((mod: any) => mod.kind === this.ts.SyntaxKind.AsyncKeyword) ||
          node.asteriskToken)) {
        hasAsync = true;
      }
    });
    return hasAsync;
  }

  private hasTypeDefinitions(sourceFile: any): boolean {
    let hasTypes = false;
    this.ts.forEachChild(sourceFile, (node: any) => {
      if (node.kind === this.ts.SyntaxKind.InterfaceDeclaration ||
        node.kind === this.ts.SyntaxKind.TypeAliasDeclaration ||
        node.kind === this.ts.SyntaxKind.EnumDeclaration) {
        hasTypes = true;
      }
    });
    return hasTypes;
  }

  private hasGenericTypes(sourceFile: any): boolean {
    let hasGenerics = false;
    this.ts.forEachChild(sourceFile, (node: any) => {
      if (node.typeParameters && node.typeParameters.length > 0) {
        hasGenerics = true;
      }
    });
    return hasGenerics;
  }

  private hasJSAsyncFunctions(ast: any): boolean {
    // Simplified check for async functions in JS AST
    return this.searchAST(ast, (node: any) => {
      return node.async === true;
    });
  }

  private searchAST(node: any, predicate: (node: any) => boolean): boolean {
    if (!node) return false;

    if (predicate(node)) return true;

    for (const key in node) {
      const child = node[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (this.searchAST(item, predicate)) return true;
          }
        } else {
          if (this.searchAST(child, predicate)) return true;
        }
      }
    }

    return false;
  }

  protected createFallbackMetadata(context: FileAnalysisContext): AnalysisMetadata {
    const stats = this.getFileStats(context.content);

    return {
      language: this.isTypeScriptFile(context.filePath) ? 'typescript' : 'javascript',
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

  private convertToFileAnalysisResult(result: any, content: FileContent): FileAnalysisResult {
    const metadata = result.metadata;
    return {
      success: true,
      dependencies: result.dependencies,
      classes: [], // Classes list could be extracted if we stored names
      functions: [],
      exports: [],
      imports: [],
      dynamicImports: [],
      reExports: [],
      typeHints: [],
      inheritance: [],
      hasDefaultExport: false,
      metrics: {
        functionCount: metadata?.complexity?.functions || 0,
        classCount: metadata?.complexity?.classes || 0,
        complexity: 0 // Complexity calculation not fully implemented yet
      },
      errors: result.errors
    };
  }

  private parseContentSimple(content: string): any { return {}; } // Unused/Simplification 

  private initializeTypeScript(): void {
    try {
      this.ts = ts;
    } catch {
      // Ignore
    }
  }
}