import { promises as fs } from 'fs';
import { join, extname, relative, sep } from 'path';
import {
  ProcessedDocument,
  DocumentMetadata,
  DocumentType,
  Language,
  Document,
  DocumentChunk,
} from '../interfaces';
import { DocumentProcessorService } from './document-processor';

export interface RepositoryProcessorOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  followSymlinks?: boolean;
  extractGitMetadata?: boolean;
  processBinaryFiles?: boolean;
}

export interface RepositoryScanResult {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  errorFiles: number;
  documents: ProcessedDocument[];
  errors: Array<{ filePath: string; error: string }>;
  scanTime: number;
}

export interface FileProcessingOptions {
  extractCodeStructure?: boolean;
  includeComments?: boolean;
  detectFunctions?: boolean;
  extractImports?: boolean;
  detectTests?: boolean;
}

/**
 * Repository Processor Service
 * Handles scanning and processing of code repositories for RAG indexing
 */
export class RepositoryProcessorService {
  private readonly documentProcessor: DocumentProcessorService;
  private logger: {
    log: (message: string) => void;
    warn: (message: string, error?: any) => void;
    error: (message: string, error?: any) => void;
  };
  private readonly defaultIncludePatterns = [
    '**/*.ts',
    '**/*.js',
    '**/*.tsx',
    '**/*.jsx',
    '**/*.py',
    '**/*.java',
    '**/*.go',
    '**/*.rs',
    '**/*.cpp',
    '**/*.c',
    '**/*.h',
    '**/*.cs',
    '**/*.php',
    '**/*.rb',
    '**/*.swift',
    '**/*.kt',
    '**/*.scala',
    '**/*.md',
    '**/*.txt',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
    '**/*.toml',
    '**/*.xml',
    '**/*.sql',
    '**/*.sh',
    '**/*.bash',
    '**/*.zsh',
    '**/*.dockerfile',
    '**/Dockerfile*',
    '**/README*',
    '**/CHANGELOG*',
    '**/LICENSE*',
    '**/.env.example',
  ];

  private readonly defaultExcludePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/coverage/**',
    '**/.coverage/**',
    '**/vendor/**',
    '**/target/**',
    '**/bin/**',
    '**/obj/**',
    '**/*.log',
    '**/*.tmp',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.min.js',
    '**/*.min.css',
    '**/*.map',
    '**/*.lock',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
  ];

  private readonly supportedExtensions = new Map([
    ['.ts', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.js', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.tsx', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.jsx', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.py', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.java', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.go', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.rs', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.cpp', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.c', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.h', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.cs', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.php', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.rb', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.swift', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.kt', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.scala', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.md', { type: DocumentType.MARKDOWN, language: Language.ENGLISH }],
    ['.txt', { type: DocumentType.PLAIN_TEXT, language: Language.ENGLISH }],
    ['.json', { type: DocumentType.JSON, language: Language.ENGLISH }],
    ['.yaml', { type: DocumentType.PLAIN_TEXT, language: Language.ENGLISH }],
    ['.yml', { type: DocumentType.PLAIN_TEXT, language: Language.ENGLISH }],
    ['.toml', { type: DocumentType.PLAIN_TEXT, language: Language.ENGLISH }],
    ['.xml', { type: DocumentType.PLAIN_TEXT, language: Language.ENGLISH }],
    ['.sql', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.sh', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.bash', { type: DocumentType.CODE, language: Language.ENGLISH }],
    ['.zsh', { type: DocumentType.CODE, language: Language.ENGLISH }],
  ]);

  constructor(options: RepositoryProcessorOptions = {}) {
    this.logger = {
      log: (message: string) => console.log(`[RepositoryProcessor] ${message}`),
      warn: (message: string, error?: any) =>
        console.warn(`[RepositoryProcessor] ${message}`, error || ''),
      error: (message: string, error?: any) =>
        console.error(`[RepositoryProcessor] ${message}`, error || ''),
    };

    this.documentProcessor = new DocumentProcessorService({
      chunkSize: 1000,
      chunkOverlap: 200,
      maxChunkSize: 2000,
      extractMetadata: true,
      detectLanguage: true,
      extractEntities: true,
    });
  }

  /**
   * Scan and process an entire repository
   */
  async processRepository(
    repositoryPath: string,
    options: RepositoryProcessorOptions = {}
  ): Promise<RepositoryScanResult> {
    const startTime = Date.now();
    this.logger.log(`Starting repository scan: ${repositoryPath}`);

    const mergedOptions = this.mergeOptions(options);
    const files = await this.scanRepositoryFiles(repositoryPath, mergedOptions);

    this.logger.log(`Found ${files.length} files to process`);

    const result: RepositoryScanResult = {
      totalFiles: files.length,
      processedFiles: 0,
      skippedFiles: 0,
      errorFiles: 0,
      documents: [],
      errors: [],
      scanTime: 0,
    };

    // Process files in batches to manage memory
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      const batchPromises = batch.map(async filePath => {
        try {
          const document = await this.processFile(filePath, {
            repositoryPath: repositoryPath || undefined,
            extractGitMetadata: mergedOptions.extractGitMetadata || false,
          });

          if (document) {
            result.documents.push(document);
            result.processedFiles++;
          } else {
            result.skippedFiles++;
          }
        } catch (error) {
          result.errorFiles++;
          result.errors.push({
            filePath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          this.logger.error(`Failed to process file: ${filePath}`, error);
        }
      });

      await Promise.all(batchPromises);

      // Log progress
      if (i % 50 === 0 || i + batchSize >= files.length) {
        this.logger.log(
          `Processed ${Math.min(i + batchSize, files.length)}/${files.length} files`
        );
      }
    }

    result.scanTime = Date.now() - startTime;
    this.logger.log(`Repository scan completed in ${result.scanTime}ms`);
    this.logger.log(
      `Processed: ${result.processedFiles}, Skipped: ${result.skippedFiles}, Errors: ${result.errorFiles}`
    );

    return result;
  }

  /**
   * Process a single file
   */
  async processFile(
    filePath: string,
    options: {
      repositoryPath?: string;
      content?: string;
      metadata?: DocumentMetadata;
      extractGitMetadata?: boolean;
    } = {}
  ): Promise<ProcessedDocument | null> {
    try {
      // Read file content if not provided
      const content = options.content || (await fs.readFile(filePath, 'utf-8'));

      // Skip if file is too large or empty
      if (!content.trim()) {
        this.logger.warn(`Skipping empty file: ${filePath}`);
        return null;
      }

      // Determine file type and language
      const ext = extname(filePath).toLowerCase();
      const fileInfo = this.supportedExtensions.get(ext);

      if (!fileInfo) {
        this.logger.warn(`Unsupported file type: ${ext} in ${filePath}`);
        return null;
      }

      // Extract metadata
      const metadata = await this.extractFileMetadata(
        filePath,
        content,
        options
      );

      // Process content with document processor
      const processedDocument = await this.documentProcessor.processDocument(
        content,
        {
          documentId: this.generateDocumentId(filePath),
          title: this.extractTitle(filePath, metadata),
          source: options.repositoryPath
            ? relative(options.repositoryPath, filePath)
            : filePath,
          metadata: {
            ...metadata,
            ...fileInfo,
            filePath,
            originalPath: filePath,
            documentType: fileInfo.type,
            language: this.detectCodeLanguage(filePath),
          } as any,
        }
      );

      return processedDocument;
    } catch (error) {
      this.logger.error(`Failed to process file: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Scan repository for files matching patterns
   */
  private async scanRepositoryFiles(
    repositoryPath: string,
    options: RepositoryProcessorOptions
  ): Promise<string[]> {
    const files: string[] = [];

    const scanDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);

          if (entry.isDirectory()) {
            if (options.followSymlinks || !entry.isSymbolicLink()) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.shouldProcessFile(fullPath, repositoryPath, options)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to scan directory: ${dirPath}`, error);
      }
    };

    await scanDirectory(repositoryPath);
    return files;
  }

  /**
   * Check if file should be processed based on patterns
   */
  private shouldProcessFile(
    filePath: string,
    repositoryPath: string,
    options: RepositoryProcessorOptions
  ): boolean {
    const relativePath = relative(repositoryPath, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Check include patterns
    if (options.includePatterns && options.includePatterns.length > 0) {
      const included = options.includePatterns.some(pattern =>
        this.matchPattern(normalizedPath, pattern)
      );
      if (!included) return false;
    } else {
      // Use default include patterns
      const included = this.defaultIncludePatterns.some(pattern =>
        this.matchPattern(normalizedPath, pattern)
      );
      if (!included) return false;
    }

    // Check exclude patterns
    const excludePatterns = [...this.defaultExcludePatterns];
    if (options.excludePatterns) {
      excludePatterns.push(...options.excludePatterns);
    }

    const excluded = excludePatterns.some(pattern =>
      this.matchPattern(normalizedPath, pattern)
    );

    return !excluded;
  }

  /**
   * Match glob pattern
   */
  private matchPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Extract metadata from file
   */
  private async extractFileMetadata(
    filePath: string,
    content: string,
    options: {
      repositoryPath?: string;
      metadata?: DocumentMetadata;
      extractGitMetadata?: boolean;
    }
  ): Promise<DocumentMetadata> {
    const stats = await fs.stat(filePath);
    const ext = extname(filePath).toLowerCase();

    let metadata: DocumentMetadata = {
      source: options.repositoryPath
        ? relative(options.repositoryPath, filePath)
        : filePath,
      type: this.supportedExtensions.get(ext)?.type || DocumentType.PLAIN_TEXT,
      wordCount: this.countWords(content),
      language: this.detectCodeLanguage(filePath),
      lastAccessed: stats.atime,
      custom: {
        fileSize: stats.size,
        lastModified: stats.mtime,
        created: stats.birthtime,
        extension: ext,
        encoding: 'utf-8',
      },
    };

    // Add code-specific metadata
    if (this.isCodeFile(ext)) {
      metadata.custom = {
        ...metadata.custom,
        ...this.extractCodeMetadata(content, ext),
      };
    }

    // Add Git metadata if requested
    if (options.extractGitMetadata) {
      try {
        const gitMetadata = await this.extractGitMetadata(filePath);
        metadata.custom = {
          ...metadata.custom,
          ...gitMetadata,
        };
      } catch (error) {
        this.logger.warn(
          `Failed to extract Git metadata for ${filePath}`,
          error
        );
      }
    }

    // Merge with provided metadata
    if (options.metadata) {
      metadata = { ...metadata, ...options.metadata };
    }

    return metadata;
  }

  /**
   * Extract code-specific metadata
   */
  private extractCodeMetadata(
    content: string,
    extension: string
  ): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Count lines
    const lines = content.split('\n');
    metadata.lineCount = lines.length;
    metadata.emptyLines = lines.filter(line => !line.trim()).length;
    metadata.codeLines = metadata.lineCount - metadata.emptyLines;

    // Extract imports/requires
    const imports = this.extractImports(content, extension);
    if (imports.length > 0) {
      metadata.imports = imports;
    }

    // Extract functions/classes
    const functions = this.extractFunctions(content, extension);
    if (functions.length > 0) {
      metadata.functions = functions;
    }

    // Detect if it's a test file
    metadata.isTestFile = this.isTestFile(content, extension);

    // Extract comments
    const comments = this.extractComments(content, extension);
    if (comments.length > 0) {
      metadata.comments = comments;
      metadata.commentRatio = comments.join('\n').length / content.length;
    }

    return metadata;
  }

  /**
   * Extract imports/dependencies from code
   */
  private extractImports(content: string, extension: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');

    const patterns: Record<string, RegExp[]> = {
      '.js': [
        /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
        /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      ],
      '.ts': [
        /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
        /import\s+['"`]([^'"`]+)['"`]/g,
      ],
      '.py': [/import\s+([^\s]+)/g, /from\s+([^\s]+)\s+import/g],
      '.java': [/import\s+([^\s]+);/g],
      '.go': [/import\s+['"`]([^'"`]+)['"`]/g],
      '.rs': [/use\s+([^;]+);/g],
      '.cpp': [/#include\s*[<"]([^>"]+)[>"]/g],
      '.c': [/#include\s*[<"]([^>"]+)[>"]/g],
    };

    const patternList = patterns[extension] || patterns['.js'];

    if (!patternList) return imports;

    for (const pattern of patternList) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath && !imports.includes(importPath)) {
          imports.push(importPath);
        }
      }
    }

    return imports;
  }

  /**
   * Extract function names from code
   */
  private extractFunctions(content: string, extension: string): string[] {
    const functions: string[] = [];

    const patterns: Record<string, RegExp> = {
      '.js':
        /(?:function\s+(\w+)|(\w+)\s*:\s*function|(\w+)\s*=\s*function|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>)/g,
      '.ts':
        /(?:function\s+(\w+)|(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]|const\s+(\w+)\s*=\s*\([^)]*\)\s*=>)/g,
      '.py': /def\s+(\w+)\s*\(/g,
      '.java':
        /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*[{;]/g,
      '.go': /func\s+(\w+)\s*\(/g,
      '.rs': /fn\s+(\w+)\s*\(/g,
      '.cpp': /(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*[{;]/g,
      '.cs':
        /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*[{;]/g,
    };

    const pattern = patterns[extension];
    if (!pattern) return functions;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3] || match[4];
      if (functionName && !functions.includes(functionName)) {
        functions.push(functionName);
      }
    }

    return functions;
  }

  /**
   * Extract comments from code
   */
  private extractComments(content: string, extension: string): string[] {
    const comments: string[] = [];

    const patterns: Record<string, RegExp[]> = {
      '.js': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm],
      '.ts': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm],
      '.py': [/#[^]*$/gm, /'''[\s\S]*?'''/g, /"""[\s\S]*?"""/g],
      '.java': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm],
      '.go': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm],
      '.rs': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm],
      '.cpp': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm],
      '.c': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm],
      '.cs': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm],
      '.php': [/\/\*[\s\S]*?\*\//g, /\/\/.*$/gm, /#.*$/gm],
    };

    const patternList = patterns[extension] || patterns['.js'];

    if (!patternList) return comments;

    for (const pattern of patternList) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const comment = match[0].trim();
        if (comment && !comments.includes(comment)) {
          comments.push(comment);
        }
      }
    }

    return comments;
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(content: string, filePath: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /__tests__/,
      /test_/,
      /_test\./,
      /spec_/,
      /_spec\./,
    ];

    return (
      testPatterns.some(pattern => pattern.test(filePath)) ||
      content.includes('describe(') ||
      content.includes('it(') ||
      content.includes('test(') ||
      content.includes('Test(') ||
      content.includes('expect(')
    );
  }

  /**
   * Extract Git metadata for file
   */
  private async extractGitMetadata(
    filePath: string
  ): Promise<Record<string, any>> {
    // This is a simplified version - in practice you'd use a Git library
    // like 'simple-git' to get comprehensive Git information

    const metadata: Record<string, any> = {};

    try {
      // Check if we're in a git repository
      const { execSync } = require('child_process');
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf8',
        cwd: require('path').dirname(filePath),
        stdio: 'ignore',
      }).trim();

      metadata.gitRepository = gitRoot;

      // Get file blame information (simplified)
      try {
        const blame = execSync(`git blame --line-porcelain "${filePath}"`, {
          encoding: 'utf8',
          cwd: require('path').dirname(filePath),
          stdio: 'ignore',
        });

        // Extract author information from blame
        const authors = new Set<string>();
        const lines = blame.split('\n');

        for (const line of lines) {
          if (line.startsWith('author ')) {
            authors.add(line.substring(7));
          }
        }

        metadata.authors = Array.from(authors);
        metadata.authorCount = authors.size;
      } catch (error) {
        // Git blame failed, continue without it
      }
    } catch (error) {
      // Not a git repository or git command failed
    }

    return metadata;
  }

  /**
   * Detect programming language from file extension
   */
  private detectCodeLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();

    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C',
      '.h': 'C/C++',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.sh': 'Shell',
      '.bash': 'Bash',
      '.zsh': 'Zsh',
      '.sql': 'SQL',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.xml': 'XML',
    };

    return languageMap[ext] || 'Unknown';
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(extension: string): boolean {
    return this.supportedExtensions.has(extension);
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Extract title from file path and metadata
   */
  private extractTitle(filePath: string, metadata: DocumentMetadata): string {
    const fileName = require('path').basename(filePath);
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

    // Convert to title case
    const title = nameWithoutExt
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase());

    return title || fileName;
  }

  /**
   * Generate document ID
   */
  private generateDocumentId(filePath: string): string {
    return `doc_${Buffer.from(filePath)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 20)}_${Date.now()}`;
  }

  /**
   * Merge default options with provided options
   */
  private mergeOptions(
    options: RepositoryProcessorOptions
  ): RepositoryProcessorOptions {
    return {
      includePatterns: options.includePatterns || this.defaultIncludePatterns,
      excludePatterns: options.excludePatterns || this.defaultExcludePatterns,
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      followSymlinks: options.followSymlinks || false,
      extractGitMetadata: options.extractGitMetadata || true,
      processBinaryFiles: options.processBinaryFiles || false,
    };
  }
}
