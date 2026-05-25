/**
 * Context Provider for LunaForge Commands
 * Provides contextual information for when clauses and command filtering
 */

import * as vscode from 'vscode';
import type { LunaForgeCore } from 'lunaforge-core';
import { CommandContext } from './types';

export class ContextProvider {
  private lastContextUpdate = 0;
  private cachedContext: CommandContext | null = null;

  /**
   * Get current command context
   */
  getContext(core?: LunaForgeCore | null): CommandContext {
    const now = Date.now();

    // Cache context for 1 second to avoid excessive recalculations
    if (this.cachedContext && (now - this.lastContextUpdate) < 1000) {
      return this.cachedContext;
    }

    const context: CommandContext = {
      mode: this.getCurrentMode(core),
      hasGraph: this.hasGraph(core),
      hasLicense: this.hasLicense(),
      isPremium: this.isPremium(),
      workspaceOpen: this.isWorkspaceOpen(),
      selectedFile: this.getSelectedFile(),
      activeEditor: this.getActiveEditor(),
      hasSelection: this.hasSelection(),
      isTypescriptFile: this.isTypescriptFile(),
      isJavaScriptFile: this.isJavaScriptFile(),
      isPythonFile: this.isPythonFile(),
      projectSize: this.getProjectSize(),
      graphSize: this.getGraphSize(core)
    };

    this.cachedContext = context;
    this.lastContextUpdate = now;

    return context;
  }

  /**
   * Get current active mode
   */
  private getCurrentMode(core?: LunaForgeCore | null): string {
    if (!core) return 'none';

    try {
      const modes = (core as any).getActiveModes?.();
      if (!modes || modes.length === 0) return 'none';

      const activeMode = modes.find((mode: any) => mode.active);
      return activeMode?.id || 'none';
    } catch (error) {
      console.error('Error getting current mode:', error);
      return 'none';
    }
  }

  /**
   * Check if graph is available
   */
  private hasGraph(core?: LunaForgeCore | null): boolean {
    if (!core) return false;

    try {
      // Try to get graph - if it succeeds, graph exists
      const graph = core.getGraph?.();
      return graph != null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user has license
   */
  private hasLicense(): boolean {
    try {
      const config = vscode.workspace.getConfiguration('lunaforge');
      return config.get<boolean>('hasLicense', false);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user has premium license
   */
  private isPremium(): boolean {
    try {
      const config = vscode.workspace.getConfiguration('lunaforge');
      return config.get<string>('licensePlan', 'free') !== 'free';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if workspace is open
   */
  private isWorkspaceOpen(): boolean {
    return !!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0);
  }

  /**
   * Get selected file path
   */
  private getSelectedFile(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    return editor?.document.uri.fsPath;
  }

  /**
   * Get active editor path
   */
  private getActiveEditor(): string | undefined {
    return this.getSelectedFile();
  }

  /**
   * Check if there's a selection in the active editor
   */
  private hasSelection(): boolean {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return false;

    const selection = editor.selection;
    return !selection.isEmpty;
  }

  /**
   * Check if active file is TypeScript
   */
  private isTypescriptFile(): boolean {
    const fileName = this.getSelectedFile();
    if (!fileName) return false;

    return /\.(ts|tsx)$/i.test(fileName);
  }

  /**
   * Check if active file is JavaScript
   */
  private isJavaScriptFile(): boolean {
    const fileName = this.getSelectedFile();
    if (!fileName) return false;

    return /\.(js|jsx)$/i.test(fileName);
  }

  /**
   * Check if active file is Python
   */
  private isPythonFile(): boolean {
    const fileName = this.getSelectedFile();
    if (!fileName) return false;

    return /\.py$/i.test(fileName);
  }

  /**
   * Get project size (approximate)
   */
  private getProjectSize(): 'small' | 'medium' | 'large' {
    try {
      const files = vscode.workspace.findFiles('**/*', '**/node_modules/**', 1);
      // This is async, so we'll return a default for now
      return 'medium';
    } catch (error) {
      return 'medium';
    }
  }

  /**
   * Get graph size
   */
  private getGraphSize(core?: LunaForgeCore | null): 'small' | 'medium' | 'large' {
    if (!core) return 'small';

    try {
      const graph = core.getGraph?.();
      if (!graph) return 'small';

      const nodeCount = graph.files.length;
      if (nodeCount < 100) return 'small';
      if (nodeCount < 1000) return 'medium';
      return 'large';
    } catch (error) {
      return 'small';
    }
  }

  /**
   * Clear cached context
   */
  clearCache(): void {
    this.cachedContext = null;
    this.lastContextUpdate = 0;
  }

  /**
   * Get context for when clause evaluation
   */
  getWhenClauseContext(): Record<string, boolean> {
    const context = this.getContext();

    return {
      workspaceOpen: context.workspaceOpen,
      hasGraph: context.hasGraph,
      hasLicense: context.hasLicense,
      isPremium: context.isPremium,
      hasSelection: context.hasSelection,
      isTypescriptFile: context.isTypescriptFile,
      isJavaScriptFile: context.isJavaScriptFile,
      isPythonFile: context.isPythonFile,
      isSmallProject: context.projectSize === 'small',
      isMediumProject: context.projectSize === 'medium',
      isLargeProject: context.projectSize === 'large',
      isSmallGraph: context.graphSize === 'small',
      isMediumGraph: context.graphSize === 'medium',
      isLargeGraph: context.graphSize === 'large',
      isGalaxyMode: context.mode === 'galaxy',
      isCodeFlowMode: context.mode === 'codeflow',
      isTimeTravelMode: context.mode === 'timetravel',
      isAutopsyMode: context.mode === 'autopsy',
      isComposerMode: context.mode === 'composer',
      isProphecyMode: context.mode === 'prophecy',
      isParallelUniverseMode: context.mode === 'parallel-universe',
      isGuardianMode: context.mode === 'guardian',
      isRitualMode: context.mode === 'ritual',
      isDreamMode: context.mode === 'dream',
      isMythicMode: context.mode === 'mythic'
    };
  }
}