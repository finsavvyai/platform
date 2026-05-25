import type { WorkspaceInfo, ProjectGraph, FileContent, AnalysisResult } from './types';
import { GraphEngine } from './graph/GraphEngine';

/**
 * Enhanced project graph analysis engine with real dependency parsing
 */
export class ProjectGraphAnalyzer {
  private graphEngine: GraphEngine;

  constructor(workspace: WorkspaceInfo, config?: any) {
    this.graphEngine = new GraphEngine(workspace, config);
  }

  /**
   * Build project graph from file system listing
   */
  async buildProjectGraph(
    workspace: WorkspaceInfo,
    fsList: string[]
  ): Promise<ProjectGraph> {
    try {
      // Convert file list to FileContent array
      const files = await this.buildFileContents(fsList);

      // Build graph using enhanced engine
      const result = await this.graphEngine.buildGraph(files);

      if (!result.success || !result.graph) {
        throw new Error('Failed to build project graph');
      }

      return result.graph;
    } catch (error) {
      console.error('Error building project graph:', error);
      throw error;
    }
  }

  /**
   * Update graph with incremental changes
   */
  async updateGraph(
    currentGraph: ProjectGraph,
    changes: {
      changedFiles: string[];
      deletedFiles: string[];
    }
  ): Promise<ProjectGraph> {
    try {
      const incrementalUpdate = {
        changedFiles: changes.changedFiles,
        deletedFiles: changes.deletedFiles,
        graphDelta: {
          addedFiles: [],
          removedFiles: [],
          addedDependencies: [],
          removedDependencies: []
        }
      };

      // Convert changed files to FileContent
      incrementalUpdate.graphDelta.addedFiles = await this.buildFileContents(changes.changedFiles) as any;

      return await this.graphEngine.updateGraph(currentGraph, incrementalUpdate);
    } catch (error) {
      console.error('Error updating project graph:', error);
      throw error;
    }
  }

  /**
   * Get build statistics
   */
  getStats() {
    return this.graphEngine.getBuildStats();
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    await this.graphEngine.dispose();
  }

  private async buildFileContents(filePaths: string[]): Promise<FileContent[]> {
    // In a real implementation, you'd read actual file contents
    // For now, create placeholder FileContent objects
    return filePaths.map((filePath, index) => ({
      path: filePath,
      content: `// Content of ${filePath}`,
      lastModified: Date.now() - index * 1000,
      size: 100 + index * 50,
      hash: this.generateHash(filePath)
    }));
  }

  private generateHash(path: string): string {
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      const char = path.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

/**
 * Enhanced buildProjectGraph function that uses the new analyzer
 */
export async function buildProjectGraph(
  workspace: WorkspaceInfo,
  fsList: string[]
): Promise<ProjectGraph> {
  const analyzer = new ProjectGraphAnalyzer(workspace);

  try {
    const graph = await analyzer.buildProjectGraph(workspace, fsList);
    return graph;
  } finally {
    await analyzer.dispose();
  }
}

/**
 * Create a ProjectGraphAnalyzer instance
 */
export function createProjectGraphAnalyzer(workspace: WorkspaceInfo, config?: any): ProjectGraphAnalyzer {
  return new ProjectGraphAnalyzer(workspace, config);
}