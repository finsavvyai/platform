import type { ProjectGraph, ProjectFile, ProjectDependency, WorkspaceInfo, AnalysisResult, IncrementalUpdate, GraphAnalytics } from '../types';
import { LanguageAnalyzer } from '../analyzers/LanguageAnalyzer';
import { TypeScriptAnalyzer } from '../analyzers/TypeScriptAnalyzer';
import { PythonAnalyzer } from '../analyzers/PythonAnalyzer';
import type { FileAnalysisContext } from '../analyzers/LanguageAnalyzer';

export interface GraphEngineConfig {
  enableIncremental: boolean;
  enableCaching: boolean;
  concurrency: number;
  maxFileSize: number;
  excludePatterns: RegExp[];
  includePatterns: RegExp[];
  analyzers: LanguageAnalyzer[];
}

export interface GraphCache {
  get(key: string): Promise<ProjectGraph | null>;
  set(key: string, graph: ProjectGraph, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): { entries: number; size: number };
}

export interface BuildOptions {
  forceRebuild?: boolean;
  fileFilter?: (filePath: string) => boolean;
}

export interface FileContent {
  path: string;
  content: string;
  lastModified: number;
  size: number;
  hash: string;
}

/**
 * Enhanced GraphEngine with incremental building, caching, and multi-language support
 */
export class GraphEngine {
  private config: GraphEngineConfig;
  private analyzers: Map<string, LanguageAnalyzer> = new Map();
  private cache?: GraphCache;
  private workspace: WorkspaceInfo;
  private lastBuildTime: number = 0;
  private buildStats = {
    totalBuilds: 0,
    incrementalBuilds: 0,
    cacheHits: 0,
    filesAnalyzed: 0,
    errorsEncountered: 0
  };

  constructor(workspace: WorkspaceInfo, config: Partial<GraphEngineConfig> = {}) {
    this.config = {
      enableIncremental: true,
      enableCaching: true,
      concurrency: 4,
      maxFileSize: 1024 * 1024, // 1MB
      excludePatterns: [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /\.vscode/,
        /coverage/
      ],
      includePatterns: [/\.(ts|tsx|js|jsx|py|pyi)$/],
      analyzers: [
        new TypeScriptAnalyzer(),
        new PythonAnalyzer()
      ],
      ...config
    };

    this.workspace = workspace;

    // Initialize language analyzers
    this.initializeAnalyzers();

    // Initialize cache if enabled
    if (this.config.enableCaching && this.config.analyzers.length > 0) {
      this.cache = this.createMemoryCache();
    }
  }

  /**
   * Build complete project graph
   */
  async buildGraph(files: FileContent[], options: BuildOptions = {}): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.buildStats.totalBuilds++;

    try {
      // Check if incremental build is possible
      if (!options.forceRebuild && this.config.enableIncremental && this.canBuildIncremental(files)) {
        return this.buildIncremental(files);
      }

      // Build full graph
      return await this.buildFull(files, options);

    } catch (error) {
      this.buildStats.errorsEncountered++;

      return {
        success: false,
        graph: this.createEmptyGraph(),
        errors: [error instanceof Error ? { file: 'unknown', severity: 'error', message: error.message } : { file: 'unknown', severity: 'error', message: String(error) }],
        warnings: [],
        performance: {
          duration: Date.now() - startTime,
          filesAnalyzed: this.buildStats.filesAnalyzed,
          cacheHits: this.buildStats.cacheHits
        }
      };
    }
  }

  /**
   * Update graph with changed files
   */
  async updateGraph(currentGraph: ProjectGraph, changes: IncrementalUpdate): Promise<ProjectGraph> {
    const startTime = Date.now();
    this.buildStats.totalBuilds++;
    this.buildStats.incrementalBuilds++;

    try {
      // Remove deleted files from graph
      for (const deletedFile of changes.deletedFiles) {
        this.removeFileFromGraph(currentGraph, deletedFile);
      }

      // Analyze changed files
      // Assuming caller logic provides addedFiles as ProjectFile or compatible
      // We convert whatever is in graphDelta.addedFiles to FileContent
      const addedFiles: any[] = changes.graphDelta.addedFiles || [];
      const fileContents = addedFiles.map(file => this.fileToFileContent(file));

      const result = await this.analyzeFiles(fileContents);

      // Add new files to graph
      for (const file of fileContents) {
        this.addFileToGraph(currentGraph, this.createProjectFile(file));
      }

      // Add new dependencies
      for (const dependency of result.dependencies) {
        if (!this.hasDependency(currentGraph, dependency)) {
          currentGraph.dependencies.push(dependency);
        }
      }

      // Update metadata and analytics
      currentGraph.metadata = this.createMetadata(currentGraph, fileContents);
      currentGraph.analytics = this.calculateAnalytics(currentGraph);

      return currentGraph;

    } catch (error) {
      this.buildStats.errorsEncountered++;
      throw error;
    }
  }

  /**
   * Get build statistics
   */
  getBuildStats() {
    return { ...this.buildStats };
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.analyzers.keys());
  }

  /**
   * Add new language analyzer
   */
  addAnalyzer(analyzer: LanguageAnalyzer): void {
    for (const ext of analyzer.getSupportedExtensions()) {
      this.analyzers.set(ext, analyzer);
    }
  }

  /**
   * Check if file is supported for analysis
   */
  isFileSupported(filePath: string, content?: string): boolean {
    const analyzer = this.getAnalyzerForFile(filePath, content);
    return analyzer ? analyzer.canAnalyze(filePath, content) : false;
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
    this.analyzers.clear();
  }

  private async buildFull(files: FileContent[], options: BuildOptions): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Filter files based on configuration
    const filteredFiles = this.filterFiles(files);

    // Analyze files in parallel
    const analysisResults = await this.analyzeFiles(filteredFiles);

    // Build complete graph
    const graph = this.buildGraphFromResults(analysisResults);

    // Cache result if enabled
    if (this.cache && !options.forceRebuild) {
      await this.cacheGraph(graph);
    }

    const duration = Date.now() - startTime;
    return {
      success: true,
      graph,
      errors: [],
      warnings: [],
      performance: {
        duration,
        filesAnalyzed: filteredFiles.length,
        cacheHits: 0
      }
    };
  }

  private async buildIncremental(files: FileContent[]): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.buildStats.incrementalBuilds++;

    // Check cache first
    if (this.cache) {
      const cachedGraph = await this.cache.get(this.generateCacheKey());
      if (cachedGraph) {
        this.buildStats.cacheHits++;

        return {
          success: true,
          graph: cachedGraph,
          errors: [],
          warnings: [],
          performance: {
            duration: Date.now() - startTime,
            filesAnalyzed: 0,
            cacheHits: 1
          }
        };
      }
    }

    // Fall back to full build
    return this.buildFull(files, {});
  }

  private async analyzeFiles(inputFiles: FileContent[]): Promise<{
    files: ProjectFile[];
    dependencies: ProjectDependency[];
    errors: any[];
  }> {
    const files: ProjectFile[] = [];
    const dependencies: ProjectDependency[] = [];
    const errors: any[] = [];

    // Process files concurrently
    const chunkSize = Math.ceil(inputFiles.length / this.config.concurrency);
    const chunks = this.chunkArray(inputFiles, chunkSize);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(file => this.analyzeFile(file))
      );

      for (const result of chunkResults) {
        files.push(...result.files);
        dependencies.push(...result.dependencies);
        errors.push(...result.errors);
      }
    }

    return { files, dependencies, errors };
  }

  private async analyzeFile(file: FileContent): Promise<{
    files: ProjectFile[];
    dependencies: ProjectDependency[];
    errors: any[];
  }> {
    this.buildStats.filesAnalyzed++;

    try {
      // Check file size
      if (file.size > this.config.maxFileSize) {
        throw new Error(`File too large: ${file.size} bytes`);
      }

      const analyzer = this.getAnalyzerForFile(file.path, file.content);
      if (!analyzer) {
        // Unsupported file type
        return {
          files: [this.createProjectFile(file)],
          dependencies: [],
          errors: []
        };
      }

      const context: FileAnalysisContext = {
        workspace: this.workspace,
        filePath: file.path,
        relativePath: this.getRelativePath(file.path),
        content: file.content,
        language: analyzer.getLanguageName(),
        options: {
          includeTypeDependencies: true,
          includeDynamicImports: true,
          maxFileSize: this.config.maxFileSize,
          ignorePatterns: this.config.excludePatterns
        }
      };

      const result = await analyzer.analyzeFile(context);

      return {
        files: [this.createProjectFile(file)],
        dependencies: result.dependencies,
        errors: result.errors
      };

    } catch (error) {
      return {
        files: [this.createProjectFile(file)],
        dependencies: [],
        errors: [error]
      };
    }
  }

  private buildGraphFromResults(analysisResults: {
    files: ProjectFile[];
    dependencies: ProjectDependency[];
    errors: any[];
  }): ProjectGraph {
    // Remove duplicate files and dependencies
    const uniqueFiles = new Map<string, ProjectFile>();
    const uniqueDependencies = new Map<string, ProjectDependency>();

    for (const file of analysisResults.files) {
      uniqueFiles.set(file.path, file);
    }

    for (const dep of analysisResults.dependencies) {
      const key = `${dep.from}->${dep.to}->${dep.type}`;
      uniqueDependencies.set(key, dep);
    }

    const files = Array.from(uniqueFiles.values());
    const dependencies = Array.from(uniqueDependencies.values());

    // Create dummy FileContent array for metadata creation
    const dummyFileContents = files.map(f => ({
      path: f.path,
      content: "",
      lastModified: f.lastModified || 0,
      size: f.size || 0,
      hash: f.hash || ""
    }));

    const graph: ProjectGraph = {
      files: files,
      dependencies: dependencies,
      metadata: this.createMetadata(
        {
          files,
          dependencies,
          metadata: {} as any,
          analytics: {} as any
        },
        dummyFileContents
      ),
      analytics: {} as any // Placeholder
    };

    graph.analytics = this.calculateAnalytics(graph);

    return graph;
  }

  private createMetadata(graph: ProjectGraph, analyzedFiles: FileContent[]) {
    const languages = new Set<string>();

    for (const file of graph.files) {
      if (file.language) {
        languages.add(file.language);
      }
    }

    return {
      version: '1.0.0',
      buildTime: Date.now(),
      fileCount: graph.files.length,
      dependencyCount: graph.dependencies.length,
      languages: Array.from(languages),
      cacheHit: false
    };
  }

  private calculateAnalytics(graph: ProjectGraph): GraphAnalytics {
    const modules = graph.files.map(file => this.analyzeModule(file, graph));
    const hotspots = this.identifyHotspots(graph, modules);
    const circularDeps = this.detectCircularDependencies(graph);
    const complexity = this.calculateComplexity(graph, modules);
    const metrics = this.calculateGraphMetrics(graph);

    return {
      complexity,
      maintainabilityIndex: this.calculateMaintainabilityIndex(complexity, metrics),
      technicalDebt: this.calculateTechnicalDebt(circularDeps, metrics),
      circularDependencies: circularDeps,
      modules,
      hotspots,
      metrics
    };
  }

  private analyzeModule(file: ProjectFile, graph: ProjectGraph): any {
    const dependencies = graph.dependencies.filter((d: ProjectDependency) => d.from === file.path);
    const dependents = graph.dependencies.filter((d: ProjectDependency) => d.to === file.path);

    return {
      path: file.path,
      name: file.path.split('/').pop() || file.path,
      type: 'file',
      size: {
        lines: Math.floor((file.size || 0) / 50), // Rough estimate
        bytes: file.size || 0
      },
      complexity: {
        cyclomatic: dependencies.length + 1, // Simplified
        cognitive: Math.max(1, dependencies.length * 0.8)
      },
      maintainability: {
        maintainabilityIndex: 100 - (dependencies.length * 2), // Simplified
        halsteadVolume: file.size || 0
      },
      dependencies: {
        incoming: dependents.length,
        outgoing: dependencies.length,
        fanIn: dependents.length,
        fanOut: dependencies.length,
        instability: dependencies.length / (dependencies.length + dependents.length || 1)
      }
    };
  }

  private identifyHotspots(graph: ProjectGraph, modules: any[]): any[] {
    const hotspots: any[] = [];

    // Find modules with high complexity
    for (const module of modules) {
      if (module.complexity.cyclomatic > 10) {
        hotspots.push({
          filePath: module.path,
          type: 'complexity',
          score: module.complexity.cyclomatic,
          details: { cyclomaticComplexity: module.complexity.cyclomatic }
        });
      }

      if (module.dependencies.fanOut > 5) {
        hotspots.push({
          filePath: module.path,
          type: 'coupling',
          score: module.dependencies.fanOut,
          details: { fanOut: module.dependencies.fanOut }
        });
      }
    }

    return hotspots;
  }

  private detectCircularDependencies(graph: ProjectGraph): any[] {
    const circularDeps: any[] = [];
    const visited = new Set<string>();

    const visit = (node: string, currentPath: string[]): void => {
      if (visited.has(node)) {
        const index = currentPath.indexOf(node);
        if (index >= 0) {
          const cyclePath = currentPath.slice(index).concat([node]);
          circularDeps.push({
            path: cyclePath,
            type: 'import',
            severity: cyclePath.length <= 3 ? 'low' : cyclePath.length <= 5 ? 'medium' : 'high'
          });
        }
        return;
      }

      visited.add(node);
      currentPath.push(node);

      const dependencies = graph.dependencies.filter((d: ProjectDependency) => d.from === node);
      for (const dep of dependencies) {
        visit(dep.to, [...currentPath]);
      }

      currentPath.pop();
    };

    for (const file of graph.files) {
      if (!visited.has(file.path)) {
        visit(file.path, []);
      }
    }

    return circularDeps;
  }

  private calculateComplexity(graph: ProjectGraph, modules: any[]): number {
    return modules.length > 0 ? modules.reduce((sum, module) => sum + module.complexity.cyclomatic, 0) / modules.length : 0;
  }

  private calculateMaintainabilityIndex(complexity: number, metrics: any): number {
    // Simplified maintainability index calculation
    return Math.max(0, 171 - 5.2 * Math.log(complexity || 1) - 0.23 * metrics.coupling.instability - 16.2 * Math.log(metrics.cohesion || 1));
  }

  private calculateTechnicalDebt(circularDeps: any[], metrics: any): number {
    let debt = 0;

    // Debt from circular dependencies
    debt += circularDeps.length * 50; // 50 points per circular dependency

    // Debt from high coupling
    if (metrics.coupling.instability > 0.8) {
      debt += 20;
    }

    // Debt from low cohesion
    if (metrics.cohesion < 0.3) {
      debt += (0.3 - metrics.cohesion) * 100;
    }

    return debt;
  }

  private calculateGraphMetrics(graph: ProjectGraph): any {
    const totalDependencies = graph.dependencies.length;
    const maxDepth = this.calculateMaxDepth(graph);
    const coupling = this.calculateCoupling(graph);

    return {
      totalDependencies,
      dependencyDensity: totalDependencies / (graph.files.length || 1),
      averageModuleSize: graph.files.reduce((sum, file) => sum + (file.size || 0), 0) / (graph.files.length || 1),
      maxDepth,
      coupling,
      cohesion: this.calculateCohesion(graph),
      abstraction: 0.7 // Placeholder
    };
  }

  private calculateMaxDepth(graph: ProjectGraph): number {
    const depths = new Map<string, number>();

    const calculateDepth = (node: string, visited = new Set<string>()): number => {
      if (visited.has(node)) return 0;

      visited.add(node);
      let maxDepth = 0;

      const dependencies = graph.dependencies.filter((d: ProjectDependency) => d.from === node);
      for (const dep of dependencies) {
        maxDepth = Math.max(maxDepth, 1 + calculateDepth(dep.to, visited));
      }

      return maxDepth;
    };

    for (const file of graph.files) {
      depths.set(file.path, calculateDepth(file.path));
    }

    return Math.max(...Array.from(depths.values()), 0);
  }

  private calculateCoupling(graph: ProjectGraph): { afferent: number; efferent: number; instability: number } {
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();

    for (const file of graph.files) {
      incoming.set(file.path, 0);
      outgoing.set(file.path, 0);
    }

    for (const dep of graph.dependencies) {
      incoming.set(dep.to, (incoming.get(dep.to) || 0) + 1);
      outgoing.set(dep.from, (outgoing.get(dep.from) || 0) + 1);
    }

    const totalIncoming = Array.from(incoming.values()).reduce((sum, count) => sum + count, 0);
    const totalOutgoing = Array.from(outgoing.values()).reduce((sum, count) => sum + count, 0);

    return {
      afferent: totalIncoming,
      efferent: totalOutgoing,
      instability: totalOutgoing / (totalIncoming + totalOutgoing || 1)
    };
  }

  private calculateCohesion(graph: ProjectGraph): number {
    // Simplified cohesion calculation
    let totalCohesion = 0;
    let moduleCount = 0;

    for (const file of graph.files) {
      const deps = graph.dependencies.filter((d: ProjectDependency) => d.from === file.path);
      if (deps.length > 0) {
        // Higher cohesion if most dependencies are internal to a cohesive group
        const internalDeps = deps.filter((d: ProjectDependency) => this.isInternalDependency(d.from, d.to, graph)).length;
        const cohesion = internalDeps / deps.length;
        totalCohesion += cohesion;
        moduleCount++;
      }
    }

    return moduleCount > 0 ? totalCohesion / moduleCount : 1;
  }

  private isInternalDependency(from: string, to: string, graph: ProjectGraph): boolean {
    // Simple heuristic: dependencies within the same directory are more cohesive
    const fromDir = from.substring(0, from.lastIndexOf('/'));
    const toDir = to.substring(0, to.lastIndexOf('/'));
    return fromDir === toDir;
  }

  private createEmptyGraph(): ProjectGraph {
    return {
      files: [],
      dependencies: [],
      metadata: {
        version: '1.0.0',
        buildTime: Date.now(),
        fileCount: 0,
        dependencyCount: 0,
        languages: []
      },
      analytics: {
        complexity: 0,
        maintainabilityIndex: 100,
        technicalDebt: 0,
        circularDependencies: [],
        modules: [],
        hotspots: [],
        metrics: {
          totalDependencies: 0,
          dependencyDensity: 0,
          averageModuleSize: 0,
          maxDepth: 0,
          coupling: {
            afferent: 0,
            efferent: 0,
            instability: 0
          },
          cohesion: 0,
          abstraction: 0
        }
      }
    };
  }

  private filterFiles(files: FileContent[]): FileContent[] {
    return files.filter(file => {
      // Check include patterns
      const isIncluded = this.config.includePatterns.some(pattern => pattern.test(file.path));
      if (!isIncluded) return false;

      // Check exclude patterns
      const isExcluded = this.config.excludePatterns.some(pattern => pattern.test(file.path));
      if (isExcluded) return false;

      return true;
    });
  }

  private canBuildIncremental(files: FileContent[]): boolean {
    // Simple heuristic: can do incremental build if we have a cache and recent changes
    return this.cache !== undefined && Date.now() - this.lastBuildTime < 60000; // 1 minute
  }

  private async cacheGraph(graph: ProjectGraph): Promise<void> {
    if (this.cache) {
      await this.cache.set(this.generateCacheKey(), graph, 300000); // 5 minutes TTL
    }
  }

  private generateCacheKey(): string {
    // Simple cache key based on workspace
    return `graph:${this.workspace.rootPath}:${this.workspace.name}`;
  }

  private getRelativePath(filePath: string): string {
    return filePath.replace(this.workspace.rootPath, '').replace(/^\//, '');
  }

  private fileToFileContent(file: any): FileContent {
    return {
      path: file.path,
      content: file.content || "",
      lastModified: file.lastModified || Date.now(),
      size: file.size || Buffer.byteLength(file.content || "", 'utf8'),
      hash: file.hash || this.calculateHash(file.content || "")
    };
  }

  private createProjectFile(file: FileContent): ProjectFile {
    return {
      path: file.path,
      size: file.size,
      language: this.detectLanguage(file.path),
      lastModified: file.lastModified,
      hash: file.hash
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = this.getFileExtension(filePath);
    if (this.config.analyzers.length === 0) {
      return 'unknown';
    }

    for (const analyzer of this.config.analyzers) {
      if (analyzer.getSupportedExtensions().includes(ext)) {
        return analyzer.getLanguageName();
      }
    }

    return 'unknown';
  }

  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot >= 0 ? filePath.substring(lastDot) : '';
  }

  private calculateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private getAnalyzerForFile(filePath: string, content?: string): LanguageAnalyzer | null {
    const ext = this.getFileExtension(filePath);
    return this.analyzers.get(ext) || null;
  }

  private initializeAnalyzers(): void {
    for (const analyzer of this.config.analyzers) {
      for (const ext of analyzer.getSupportedExtensions()) {
        this.analyzers.set(ext, analyzer);
      }
    }
  }

  private createMemoryCache(): GraphCache {
    const cache = new Map<string, { graph: ProjectGraph; expires: number }>();
    const maxEntries = 100;
    const defaultTTL = 300000; // 5 minutes

    return {
      async get(key: string): Promise<ProjectGraph | null> {
        const entry = cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expires) {
          cache.delete(key);
          return null;
        }

        return entry.graph;
      },

      async set(key: string, graph: ProjectGraph, ttl = defaultTTL): Promise<void> {
        if (cache.size >= maxEntries) {
          // Remove oldest entry
          const firstKey = cache.keys().next().value;
          if (firstKey) {
            cache.delete(firstKey);
          }
        }

        cache.set(key, {
          graph,
          expires: Date.now() + ttl
        });
      },

      async delete(key: string): Promise<void> {
        cache.delete(key);
      },

      async clear(): Promise<void> {
        cache.clear();
      },

      getStats(): { entries: number; size: number } {
        return {
          entries: cache.size,
          size: 0 // Not implemented
        };
      }
    };
  }

  private addFileToGraph(graph: ProjectGraph, file: ProjectFile): void {
    if (!graph.files.some(f => f.path === file.path)) {
      graph.files.push(file);
    }
  }

  private hasDependency(graph: ProjectGraph, dep: ProjectDependency): boolean {
    return graph.dependencies.some(d => d.from === dep.from && d.to === dep.to && d.type === dep.type);
  }

  private removeFileFromGraph(graph: ProjectGraph, filePath: string): void {
    graph.files = graph.files.filter(f => f.path !== filePath);
    graph.dependencies = graph.dependencies.filter(d => d.from !== filePath && d.to !== filePath);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}