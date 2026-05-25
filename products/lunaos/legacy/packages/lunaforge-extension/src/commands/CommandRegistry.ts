/**
 * Advanced Command Registry for LunaForge
 * Provides comprehensive command palette integration with context-aware suggestions
 */

import * as vscode from 'vscode';
import { CommandContext, CommandHandler, CommandRegistration } from './types';

export class CommandRegistry {
  private commands = new Map<string, CommandRegistration>();
  private contextProviders: Array<() => CommandContext> = [];

  /**
   * Register a new command
   */
  register(command: CommandRegistration): void {
    this.commands.set(command.id, command);
  }

  /**
   * Register multiple commands
   */
  registerAll(commands: CommandRegistration[]): void {
    commands.forEach(cmd => this.register(cmd));
  }

  /**
   * Get all registered commands
   */
  getAll(): CommandRegistration[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands filtered by context
   */
  getFilteredCommands(context?: Partial<CommandContext>): CommandRegistration[] {
    if (!context) return this.getAll();

    return this.getAll().filter(cmd => {
      if (cmd.when && !this.evaluateCondition(cmd.when, context as CommandContext)) {
        return false;
      }
      if (context.mode && cmd.context?.mode && cmd.context.mode !== context.mode) {
        return false;
      }
      if (context.hasGraph && cmd.context?.requiresGraph && !context.hasGraph) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get command by ID
   */
  get(id: string): CommandRegistration | undefined {
    return this.commands.get(id);
  }

  /**
   * Check if command exists
   */
  has(id: string): boolean {
    return this.commands.has(id);
  }

  /**
   * Add context provider
   */
  addContextProvider(provider: () => CommandContext): void {
    this.contextProviders.push(provider);
  }

  /**
   * Get current command context
   */
  getCurrentContext(): CommandContext {
    const context: CommandContext = {
      mode: 'unknown',
      hasGraph: false,
      hasLicense: false,
      isPremium: false,
      workspaceOpen: !!vscode.workspace.workspaceFolders
    };

    // Merge all context providers
    this.contextProviders.forEach(provider => {
      try {
        const providerContext = provider();
        Object.assign(context, providerContext);
      } catch (error) {
        console.error('Error in context provider:', error);
      }
    });

    return context;
  }

  /**
   * Evaluate when condition
   */
  private evaluateCondition(condition: string, context: CommandContext): boolean {
    try {
      // Handle simple boolean checks (most common case)
      if (condition === 'workspaceOpen') {
        return context.workspaceOpen;
      }
      if (condition === 'hasGraph') {
        return context.hasGraph;
      }
      if (condition === 'hasLicense') {
        return context.hasLicense;
      }
      if (condition === 'isPremium') {
        return context.isPremium;
      }

      // Handle negations
      if (condition.startsWith('!')) {
        const innerCondition = condition.substring(1).trim();
        return !this.evaluateCondition(innerCondition, context);
      }

      // Handle && (AND) conditions
      if (condition.includes('&&')) {
        const parts = condition.split('&&').map(p => p.trim());
        return parts.every(part => this.evaluateCondition(part, context));
      }

      // Handle || (OR) conditions
      if (condition.includes('||')) {
        const parts = condition.split('||').map(p => p.trim());
        return parts.some(part => this.evaluateCondition(part, context));
      }

      // Handle parentheses (simple case)
      if (condition.includes('(') && condition.includes(')')) {
        const innerMatch = condition.match(/\(([^)]+)\)/);
        if (innerMatch) {
          const innerResult = this.evaluateCondition(innerMatch[1], context);
          return condition.replace(/\([^)]+\)/, String(innerResult))
            .split(/\s*(&&|\|\|)\s*/)
            .reduce((acc, part, index, arr) => {
              if (index === 0) return this.evaluateCondition(part, context);
              if (part === '&&') return acc && this.evaluateCondition(arr[index + 1], context);
              if (part === '||') return acc || this.evaluateCondition(arr[index + 1], context);
              return acc;
            }, true);
        }
      }

      // Default: treat as simple boolean check
      const value = (context as any)[condition];
      return value === true || value === 'true';
    } catch (error) {
      console.error('Error evaluating condition:', condition, error);
      // Default to true for simple conditions to avoid blocking commands
      return true;
    }
  }

  /**
   * Register all commands with VS Code
   */
  registerWithVSCode(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    this.getAll().forEach(command => {
      console.log('Registering command with VS Code:', command.id);
      const disposable = vscode.commands.registerCommand(
        command.id,
        async (...args: any[]) => {
          try {
            // Check if command should be enabled
            const currentContext = this.getCurrentContext();
            if (command.when && !this.evaluateCondition(command.when, currentContext)) {
              vscode.window.showWarningMessage(
                `Command "${command.title}" is not available in the current context.`
              );
              return;
            }

            // Execute command
            await command.handler(...args);

            // Track command usage (for analytics)
            this.trackCommandUsage(command.id);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
              `Failed to execute "${command.title}": ${errorMessage}`
            );
          }
        }
      );

      disposables.push(disposable);
    });

    return disposables;
  }

  /**
   * Track command usage for analytics
   */
  private trackCommandUsage(commandId: string): void {
    // This could integrate with analytics service
    console.log(`Command executed: ${commandId}`);
  }

  /**
   * Get command suggestions for quick pick
   */
  async showCommandPicker(filter?: string): Promise<void> {
    const currentContext = this.getCurrentContext();
    let commands = this.getFilteredCommands(currentContext);

    if (filter) {
      commands = commands.filter(cmd =>
        cmd.title.toLowerCase().includes(filter.toLowerCase()) ||
        cmd.category?.toLowerCase().includes(filter.toLowerCase()) ||
        cmd.keywords?.some(keyword => keyword.toLowerCase().includes(filter.toLowerCase()))
      );
    }

    if (commands.length === 0) {
      vscode.window.showInformationMessage('No commands available for the current context.');
      return;
    }

    const items = commands.map(cmd => ({
      label: cmd.title,
      description: cmd.description,
      detail: cmd.category,
      command: cmd
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a LunaForge command...',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      try {
        await selected.command.handler();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(
          `Failed to execute "${selected.label}": ${errorMessage}`
        );
      }
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.commands.clear();
    this.contextProviders = [];
  }
}