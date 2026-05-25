/**
 * Command Manager - Central command orchestration for LunaForge
 * Integrates all command systems and provides unified command interface
 */

import * as vscode from 'vscode';
import { CommandRegistry } from './CommandRegistry';
import { CoreCommands } from './CoreCommands';
import { ContextProvider } from './ContextProvider';
import { CommandDocumentation } from './DocumentationProvider';
import type { LunaForgeCore } from 'lunaforge-core';
import { CommandContext } from './types';

export class CommandManager {
  private registry: CommandRegistry;
  private coreCommands: CoreCommands;
  private contextProvider: ContextProvider;
  private documentation: CommandDocumentation;
  private disposables: vscode.Disposable[] = [];

  constructor(private extensionUri: vscode.Uri) {
    this.registry = new CommandRegistry();
    this.coreCommands = new CoreCommands();
    this.contextProvider = new ContextProvider();
    this.documentation = new CommandDocumentation();
  }

  /**
   * Initialize the command system
   */
  async initialize(context: vscode.ExtensionContext, core: LunaForgeCore | null = null): Promise<void> {
    try {
      // Set core in command handlers (can be null initially)
      this.coreCommands.setCore(core);

      // Register context provider (handles null core)
      this.registry.addContextProvider(() => this.contextProvider.getContext(core));

      // Register all core commands
      this.registry.registerAll(this.coreCommands.getCommands());

      // Register additional utility commands
      this.registerUtilityCommands();

      // Register commands with VS Code
      const commandDisposables = this.registry.registerWithVSCode(context);
      this.disposables.push(...commandDisposables);

      // Setup command palette integration
      this.setupCommandPalette();

      // Setup context tracking
      this.setupContextTracking();

      console.log(`LunaForge Command Manager initialized with ${this.registry.getAll().length} commands`);

    } catch (error) {
      console.error('Failed to initialize Command Manager:', error);
      throw error;
    }
  }

  /**
   * Update core instance (called when core is initialized)
   */
  updateCore(core: LunaForgeCore | null): void {
    this.coreCommands.setCore(core);
    // Update context provider
    this.registry.addContextProvider(() => this.contextProvider.getContext(core));
  }

  /**
   * Register utility commands
   */
  private registerUtilityCommands(): void {
    // Command picker command
    this.registry.register({
      id: 'lunaforge.showCommandPalette',
      title: 'LunaForge: Show Command Palette',
      description: 'Show all available LunaForge commands',
      category: 'Core',
      handler: () => this.showCommandPalette(),
      keywords: ['commands', 'palette', 'all', 'list'],
      icon: '🔍'
    });

    // Command documentation
    this.registry.register({
      id: 'lunaforge.commandDocumentation',
      title: 'LunaForge: Command Documentation',
      description: 'Show documentation for LunaForge commands',
      category: 'Help',
      handler: () => this.showCommandDocumentation(),
      keywords: ['documentation', 'commands', 'help', 'reference'],
      icon: '📚'
    });

    // Command statistics
    this.registry.register({
      id: 'lunaforge.commandStats',
      title: 'LunaForge: Show Command Statistics',
      description: 'Show usage statistics for LunaForge commands',
      category: 'Debug',
      handler: () => this.showCommandStatistics(),
      keywords: ['stats', 'statistics', 'usage', 'analytics'],
      icon: '📊'
    });
  }

  /**
   * Setup command palette integration
   */
  private setupCommandPalette(): void {
    // Add command palette item
    this.disposables.push(
      vscode.commands.registerCommand('lunaforge.commandPalette', async () => {
        await this.showCommandPalette();
      })
    );
  }

  /**
   * Setup context tracking
   */
  private setupContextTracking(): void {
    // Track workspace changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.updateContext();
      })
    );

    // Track active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateContext();
      })
    );

    // Track configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('lunaforge')) {
          this.updateContext();
        }
      })
    );

    // Initial context update
    this.updateContext();
  }

  /**
   * Update VS Code context
   */
  private updateContext(): void {
    const context = this.registry.getCurrentContext();

    // Set context variables for when clauses
    vscode.commands.executeCommand('setContext', 'lunaforge.workspaceOpen', context.workspaceOpen);
    vscode.commands.executeCommand('setContext', 'lunaforge.hasGraph', context.hasGraph);
    vscode.commands.executeCommand('setContext', 'lunaforge.hasLicense', context.hasLicense);
    vscode.commands.executeCommand('setContext', 'lunaforge.isPremium', context.isPremium);
    vscode.commands.executeCommand('setContext', 'lunaforge.mode', context.mode);
  }

  /**
   * Show command palette
   */
  async showCommandPalette(filter?: string): Promise<void> {
    await this.registry.showCommandPicker(filter);
  }

  /**
   * Show command documentation
   */
  private async showCommandDocumentation(): Promise<void> {
    const commands = this.registry.getAll();
    const documentationItems = commands.map(cmd => ({
      label: cmd.title,
      description: cmd.description,
      detail: `Category: ${cmd.category || 'General'} | ID: ${cmd.id}`,
      command: cmd
    }));

    const selected = await vscode.window.showQuickPick(documentationItems, {
      placeHolder: 'Select a command to view documentation',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      const docs = this.documentation.getCommandDocs(selected.command.id);
      await this.showDetailedDocumentation(docs);
    }
  }

  /**
   * Show detailed command documentation
   */
  private async showDetailedDocumentation(docs: any): Promise<void> {
    const content = `
# ${docs.title}

${docs.description}

**Category:** ${docs.category}
**Since:** ${docs.since}

## Usage
\`\`\`
${docs.usage}
\`\`\`

${docs.examples && docs.examples.length > 0 ? `
## Examples
${docs.examples.map((example: string) => `- \`${example}\``).join('\n')}
` : ''}

${docs.arguments && docs.arguments.length > 0 ? `
## Arguments
${docs.arguments.map((arg: any) => `
- **${arg.name}** (${arg.type}${arg.required ? ', required' : ''}): ${arg.description}
${arg.default ? `  - Default: \`${arg.default}\`` : ''}
${arg.options ? `  - Options: ${arg.options.join(', ')}` : ''}
`).join('\n')}
` : ''}
    `.trim();

    // Create a new document with the documentation
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
  }

  /**
   * Show command statistics
   */
  private async showCommandStatistics(): Promise<void> {
    const commands = this.registry.getAll();
    const categories = [...new Set(commands.map(cmd => cmd.category).filter(Boolean))];

    const stats = categories.map(category => {
      const categoryCommands = commands.filter(cmd => cmd.category === category);
      return {
        category,
        count: categoryCommands.length,
        commands: categoryCommands.map(cmd => cmd.title)
      };
    });

    const message = `
📊 LunaForge Command Statistics

Total Commands: ${commands.length}
Categories: ${categories.length}

${stats.map(stat => `
**${stat.category}**: ${stat.count} commands
${stat.commands.slice(0, 3).join(', ')}${stat.commands.length > 3 ? '...' : ''}
`).join('\n')}
    `.trim();

    vscode.window.showInformationMessage(message, { modal: true });
  }

  /**
   * Get command by ID
   */
  getCommand(id: string) {
    return this.registry.get(id);
  }

  /**
   * Get all commands
   */
  getAllCommands() {
    return this.registry.getAll();
  }

  /**
   * Get commands filtered by context
   */
  getFilteredCommands(context?: Partial<CommandContext>) {
    return this.registry.getFilteredCommands(context);
  }

  /**
   * Execute command by ID
   */
  async executeCommand(id: string, ...args: any[]): Promise<void> {
    const command = this.registry.get(id);
    if (!command) {
      throw new Error(`Command not found: ${id}`);
    }

    return command.handler(...args);
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.registry.dispose();
    this.disposables = [];
  }
}